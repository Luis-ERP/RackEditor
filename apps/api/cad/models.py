from django.db import models

HOLE_STEP_IN = 2

ROW_CONFIGURATION_CHOICES = [
    ("SINGLE", "SINGLE"),
    ("BACK_TO_BACK_2", "BACK_TO_BACK_2"),
    ("BACK_TO_BACK_3", "BACK_TO_BACK_3"),
    ("BACK_TO_BACK_4", "BACK_TO_BACK_4"),
]

LEVEL_MODE_CHOICES = [
    ("UNIFORM", "UNIFORM"),
    ("VARIABLE", "VARIABLE"),
]

VALIDATION_STATE_CHOICES = [
    ("INCOMPLETE", "INCOMPLETE"),
    ("VALID", "VALID"),
    ("VALID_WITH_WARNINGS", "VALID_WITH_WARNINGS"),
    ("INVALID", "INVALID"),
]

ACCESSORY_SCOPE_CHOICES = [
    ("RACK_LINE", "RACK_LINE"),
    ("BAY", "BAY"),
    ("LEVEL", "LEVEL"),
]

ACCESSORY_CATEGORY_CHOICES = [
    ("DERIVED", "DERIVED"),
    ("EXPLICIT", "EXPLICIT"),
]

BASE_PLATE_TYPE_CHOICES = [
    ("STANDARD", "STANDARD"),
    ("HEAVY_DUTY", "HEAVY_DUTY"),
]

ENTITY_TYPE_CHOICES = [
    ("RACK_MODULE", "RACK_MODULE"),
    ("RACK_LINE", "RACK_LINE"),
    ("WALL", "WALL"),
    ("COLUMN", "COLUMN"),
    ("TEXT_NOTE", "TEXT_NOTE"),
]

COLUMN_SHAPE_CHOICES = [
    ("RECT", "RECT"),
    ("ROUND", "ROUND"),
]


class FrameSpec(models.Model):
    id = models.CharField(primary_key=True, max_length=120)
    heightIn = models.FloatField()
    depthIn = models.FloatField()
    beamSeparationIn = models.FloatField()
    gauge = models.CharField(max_length=50)
    capacityClass = models.CharField(max_length=50)
    uprightSeries = models.CharField(max_length=100)
    compatibleConnectorTypes = models.JSONField(default=list, blank=True)
    minimumTopClearanceIn = models.FloatField()
    basePlateType = models.CharField(max_length=20, choices=BASE_PLATE_TYPE_CHOICES, default="STANDARD")

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.id


class BeamSpec(models.Model):
    id = models.CharField(primary_key=True, max_length=120)
    lengthIn = models.FloatField()
    capacityClass = models.CharField(max_length=50)
    beamSeries = models.CharField(max_length=100)
    connectorType = models.CharField(max_length=100)
    verticalEnvelopeIn = models.FloatField()
    profileHeightIn = models.FloatField()
    compatibleUprightSeries = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.id


class AccessorySpec(models.Model):
    id = models.CharField(primary_key=True, max_length=120)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=20, choices=ACCESSORY_CATEGORY_CHOICES)
    scope = models.CharField(max_length=20, choices=ACCESSORY_SCOPE_CHOICES)
    description = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.id


class DesignRevision(models.Model):
    id = models.CharField(primary_key=True, max_length=120)
    revisionNumber = models.PositiveIntegerField()
    catalogVersion = models.CharField(max_length=120)
    validationResults = models.JSONField(default=dict, blank=True)
    bomSnapshot = models.JSONField(null=True, blank=True)
    projectDocument = models.JSONField(null=True, blank=True)
    createdAt = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-createdAt", "-revisionNumber"]

    def __str__(self):
        return self.id


class RackLine(models.Model):
    id = models.CharField(primary_key=True, max_length=120)
    designRevision = models.ForeignKey(
        DesignRevision,
        on_delete=models.CASCADE,
        related_name="rackLines",
    )
    rowConfiguration = models.CharField(max_length=20, choices=ROW_CONFIGURATION_CHOICES, default="SINGLE")
    levelMode = models.CharField(max_length=20, choices=LEVEL_MODE_CHOICES, default="UNIFORM")
    backToBackConfig = models.JSONField(null=True, blank=True)
    totalBayCount = models.PositiveIntegerField(default=0)
    totalFrameCount = models.PositiveIntegerField(default=0)
    validationState = models.CharField(
        max_length=24,
        choices=VALIDATION_STATE_CHOICES,
        default="INCOMPLETE",
    )
    accessoryIds = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.id


class Frame(models.Model):
    id = models.CharField(primary_key=True, max_length=120)
    spec = models.ForeignKey(FrameSpec, on_delete=models.PROTECT, related_name="frames")
    rackLine = models.ForeignKey(
        RackLine,
        on_delete=models.CASCADE,
        related_name="frames",
        null=True,
        blank=True,
    )
    positionIndex = models.PositiveIntegerField()
    isCustomSpec = models.BooleanField(default=False)
    rowIndex = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["positionIndex", "id"]

    def __str__(self):
        return self.id


class RackModule(models.Model):
    id = models.CharField(primary_key=True, max_length=120)
    rackLine = models.ForeignKey(RackLine, on_delete=models.CASCADE, related_name="modules")
    frameSpec = models.ForeignKey(FrameSpec, on_delete=models.PROTECT, related_name="defaultModules")
    frameCount = models.PositiveIntegerField(default=0)
    startFrameIndex = models.PositiveIntegerField()
    endFrameIndex = models.PositiveIntegerField()
    rowIndex = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["startFrameIndex", "id"]

    def __str__(self):
        return self.id


class FrameOverride(models.Model):
    rackModule = models.ForeignKey(RackModule, on_delete=models.CASCADE, related_name="frameOverrideEntries")
    localFrameIndex = models.PositiveIntegerField()
    frameSpec = models.ForeignKey(FrameSpec, on_delete=models.PROTECT, related_name="overrideEntries")

    class Meta:
        ordering = ["localFrameIndex", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["rackModule", "localFrameIndex"],
                name="unique_frame_override_per_module_index",
            ),
        ]

    def __str__(self):
        return f"{self.rackModule_id}:{self.localFrameIndex}"


class Bay(models.Model):
    id = models.CharField(primary_key=True, max_length=120)
    rackModule = models.ForeignKey(RackModule, on_delete=models.CASCADE, related_name="bays")
    leftFrameIndex = models.PositiveIntegerField()
    rightFrameIndex = models.PositiveIntegerField()
    beamSpec = models.ForeignKey(BeamSpec, on_delete=models.PROTECT, related_name="bays")
    isBeamSpecCustomized = models.BooleanField(default=False)
    accessoryIds = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["leftFrameIndex", "id"]

    def __str__(self):
        return self.id


class BeamLevel(models.Model):
    id = models.CharField(primary_key=True, max_length=120)
    levelIndex = models.PositiveIntegerField()
    holeIndex = models.PositiveIntegerField()
    elevationIn = models.FloatField(blank=True, default=0)
    beamSpec = models.ForeignKey(BeamSpec, on_delete=models.PROTECT, related_name="beamLevels")
    isBeamSpecCustomized = models.BooleanField(default=False)
    bay = models.ForeignKey(Bay, on_delete=models.CASCADE, related_name="levels", null=True, blank=True)
    rackModule = models.ForeignKey(
        RackModule,
        on_delete=models.CASCADE,
        related_name="levelUnion",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["levelIndex", "id"]

    def save(self, *args, **kwargs):
        self.elevationIn = self.holeIndex * HOLE_STEP_IN
        super().save(*args, **kwargs)

    def __str__(self):
        return self.id


class Accessory(models.Model):
    id = models.CharField(primary_key=True, max_length=120)
    spec = models.ForeignKey(AccessorySpec, on_delete=models.PROTECT, related_name="accessories")
    quantity = models.PositiveIntegerField()
    targetBay = models.ForeignKey(Bay, on_delete=models.SET_NULL, null=True, blank=True, related_name="targetedAccessories")
    targetLevelIndex = models.PositiveIntegerField(null=True, blank=True)
    designRevision = models.ForeignKey(
        DesignRevision,
        on_delete=models.CASCADE,
        related_name="accessories",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.id


class RackModuleEntity(models.Model):
    id = models.CharField(primary_key=True, max_length=120)
    type = models.CharField(max_length=20, choices=ENTITY_TYPE_CHOICES, default="RACK_MODULE")
    transform = models.JSONField(default=dict)
    domainId = models.CharField(max_length=120)
    widthM = models.FloatField()
    depthM = models.FloatField()
    bayCount = models.PositiveIntegerField(default=1)
    label = models.CharField(max_length=255, blank=True, default="")
    locked = models.BooleanField(default=False)
    visible = models.BooleanField(default=True)

    class Meta:
        ordering = ["id"]


class RackLineEntity(models.Model):
    id = models.CharField(primary_key=True, max_length=120)
    type = models.CharField(max_length=20, choices=ENTITY_TYPE_CHOICES, default="RACK_LINE")
    transform = models.JSONField(default=dict)
    domainId = models.CharField(max_length=120)
    widthM = models.FloatField()
    depthM = models.FloatField()
    label = models.CharField(max_length=255, blank=True, default="")
    locked = models.BooleanField(default=False)
    visible = models.BooleanField(default=True)

    class Meta:
        ordering = ["id"]


class WallEntity(models.Model):
    id = models.CharField(primary_key=True, max_length=120)
    type = models.CharField(max_length=20, choices=ENTITY_TYPE_CHOICES, default="WALL")
    transform = models.JSONField(default=dict)
    lengthM = models.FloatField()
    thicknessM = models.FloatField(default=0.2)
    label = models.CharField(max_length=255, blank=True, default="")
    locked = models.BooleanField(default=False)
    visible = models.BooleanField(default=True)

    class Meta:
        ordering = ["id"]


class ColumnEntity(models.Model):
    id = models.CharField(primary_key=True, max_length=120)
    type = models.CharField(max_length=20, choices=ENTITY_TYPE_CHOICES, default="COLUMN")
    transform = models.JSONField(default=dict)
    widthM = models.FloatField(default=0.3)
    depthM = models.FloatField(default=0.3)
    shape = models.CharField(max_length=20, choices=COLUMN_SHAPE_CHOICES, default="RECT")
    label = models.CharField(max_length=255, blank=True, default="")
    locked = models.BooleanField(default=False)
    visible = models.BooleanField(default=True)

    class Meta:
        ordering = ["id"]


class TextNoteEntity(models.Model):
    id = models.CharField(primary_key=True, max_length=120)
    type = models.CharField(max_length=20, choices=ENTITY_TYPE_CHOICES, default="TEXT_NOTE")
    transform = models.JSONField(default=dict)
    text = models.TextField()
    fontSizeM = models.FloatField(default=0.3)
    label = models.CharField(max_length=255, blank=True, default="")
    locked = models.BooleanField(default=False)
    visible = models.BooleanField(default=True)

    class Meta:
        ordering = ["id"]
