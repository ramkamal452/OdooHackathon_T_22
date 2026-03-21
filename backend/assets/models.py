from django.conf import settings
from django.db import models


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
        if self.storage_provider == self.StorageProvider.LOCAL:
            return f'/media/{self.object_key}'
        return f'https://{self.bucket_name}.s3.amazonaws.com/{self.object_key}'
