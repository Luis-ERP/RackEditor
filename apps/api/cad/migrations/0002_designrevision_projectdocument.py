from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cad", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="designrevision",
            name="projectDocument",
            field=models.JSONField(blank=True, null=True),
        ),
    ]