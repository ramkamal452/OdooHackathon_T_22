from urllib.parse import quote

from django.conf import settings
from django.db import models


def _s3_is_active():
    storages = getattr(settings, 'STORAGES', {})
    backend = storages.get('default', {}).get('BACKEND', '')
    return 's3' in backend.lower()


def _s3_bucket_name():
    return getattr(settings, 'AWS_STORAGE_BUCKET_NAME', '')


class Asset(models.Model):

    class StorageProvider(models.IntegerChoices):
        S3 = 1, 'Amazon S3'
        CLOUDFRONT = 2, 'CloudFront-backed S3'
        LOCAL = 3, 'Local dev storage'

    storage_provider = models.PositiveSmallIntegerField(
        choices=StorageProvider.choices,
        default=StorageProvider.LOCAL,
    )
    bucket_name = models.CharField(max_length=255, blank=True)
    object_key = models.CharField(max_length=700, unique=True)
    file_name = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=127, blank=True)
    file_size_bytes = models.PositiveBigIntegerField(default=0)
    checksum_sha256 = models.CharField(max_length=64, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    etag = models.CharField(max_length=255, blank=True)
    is_public = models.BooleanField(default=False)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_assets',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['uploaded_by', 'created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return self.file_name

    @property
    def url(self):
        use_s3 = (
            self.storage_provider in (self.StorageProvider.S3, self.StorageProvider.CLOUDFRONT)
            or _s3_is_active()
        )
        if use_s3:
            bucket = self.bucket_name or _s3_bucket_name()
            if bucket:
                region = getattr(settings, 'AWS_S3_REGION_NAME', 'us-east-1')
                encoded_key = quote(self.object_key, safe='/')
                return f'https://{bucket}.s3.{region}.amazonaws.com/{encoded_key}'
        return f'/media/{self.object_key}'

    def delete_from_storage(self):
        """Remove the file from storage (S3 or local)."""
        try:
            from django.core.files.storage import default_storage
            if self.object_key and default_storage.exists(self.object_key):
                default_storage.delete(self.object_key)
        except Exception:
            pass

    @classmethod
    def upload_file(cls, file_obj, user=None, object_key=None):
        from django.core.files.storage import default_storage

        key = object_key or f'uploads/{file_obj.name}'
        saved_name = default_storage.save(key, file_obj)

        if _s3_is_active():
            provider = cls.StorageProvider.S3
            bucket = _s3_bucket_name()
        else:
            provider = cls.StorageProvider.LOCAL
            bucket = ''

        asset = cls.objects.create(
            storage_provider=provider,
            bucket_name=bucket,
            object_key=saved_name,
            file_name=file_obj.name,
            mime_type=getattr(file_obj, 'content_type', ''),
            file_size_bytes=file_obj.size,
            is_public=True,
            uploaded_by=user,
        )
        return asset


from django.db.models.signals import pre_delete
from django.dispatch import receiver


@receiver(pre_delete, sender=Asset)
def cleanup_asset_storage(sender, instance, **kwargs):
    instance.delete_from_storage()
