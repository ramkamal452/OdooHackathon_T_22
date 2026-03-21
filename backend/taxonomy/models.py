from django.db import models
from django.utils.text import slugify


class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'categories'
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name) or 'category'
            slug = base
            n = 1
            qs = Category.objects.exclude(pk=self.pk) if self.pk else Category.objects.all()
            while qs.filter(slug=slug).exists():
                slug = f'{base}-{n}'
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)


class Tag(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name) or 'tag'
            slug = base
            n = 1
            qs = Tag.objects.exclude(pk=self.pk) if self.pk else Tag.objects.all()
            while qs.filter(slug=slug).exists():
                slug = f'{base}-{n}'
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)


class EntityCategory(models.Model):
    entity = models.ForeignKey(
        'content.ContentEntity',
        on_delete=models.CASCADE,
        related_name='entity_categories',
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name='entity_categories',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['entity', 'category']]

    def __str__(self):
        return f'{self.entity_id} -> {self.category}'


class EntityTag(models.Model):
    entity = models.ForeignKey(
        'content.ContentEntity',
        on_delete=models.CASCADE,
        related_name='entity_tags',
    )
    tag = models.ForeignKey(
        Tag,
        on_delete=models.CASCADE,
        related_name='entity_tags',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['entity', 'tag']]

    def __str__(self):
        return f'{self.entity_id} -> {self.tag}'
