from django.contrib import admin

from .models import (
    Accessory,
    AccessorySpec,
    Bay,
    BeamLevel,
    BeamSpec,
    ColumnEntity,
    DesignRevision,
    Frame,
    FrameOverride,
    FrameSpec,
    RackLine,
    RackLineEntity,
    RackModule,
    RackModuleEntity,
    TextNoteEntity,
    WallEntity,
)


@admin.register(FrameSpec)
class FrameSpecAdmin(admin.ModelAdmin):
    list_display = ("id", "heightIn", "depthIn", "beamSeparationIn", "capacityClass", "uprightSeries", "basePlateType")
    search_fields = ("id", "gauge", "capacityClass", "uprightSeries")
    list_filter = ("capacityClass", "basePlateType", "uprightSeries")


@admin.register(BeamSpec)
class BeamSpecAdmin(admin.ModelAdmin):
    list_display = ("id", "lengthIn", "capacityClass", "beamSeries", "connectorType")
    search_fields = ("id", "capacityClass", "beamSeries", "connectorType")
    list_filter = ("capacityClass", "beamSeries", "connectorType")


@admin.register(AccessorySpec)
class AccessorySpecAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "category", "scope")
    search_fields = ("id", "name", "description")
    list_filter = ("category", "scope")


@admin.register(DesignRevision)
class DesignRevisionAdmin(admin.ModelAdmin):
    list_display = ("id", "revisionNumber", "catalogVersion", "createdAt")
    search_fields = ("id", "catalogVersion")
    readonly_fields = ("createdAt",)


@admin.register(RackLine)
class RackLineAdmin(admin.ModelAdmin):
    list_display = ("id", "designRevision", "rowConfiguration", "levelMode", "totalBayCount", "totalFrameCount", "validationState")
    search_fields = ("id", "designRevision__id")
    list_filter = ("rowConfiguration", "levelMode", "validationState")


@admin.register(Frame)
class FrameAdmin(admin.ModelAdmin):
    list_display = ("id", "spec", "rackLine", "positionIndex", "isCustomSpec", "rowIndex")
    search_fields = ("id", "spec__id", "rackLine__id")
    list_filter = ("isCustomSpec",)


@admin.register(RackModule)
class RackModuleAdmin(admin.ModelAdmin):
    list_display = ("id", "rackLine", "frameSpec", "frameCount", "startFrameIndex", "endFrameIndex", "rowIndex")
    search_fields = ("id", "rackLine__id", "frameSpec__id")


@admin.register(FrameOverride)
class FrameOverrideAdmin(admin.ModelAdmin):
    list_display = ("id", "rackModule", "localFrameIndex", "frameSpec")
    search_fields = ("rackModule__id", "frameSpec__id")


@admin.register(Bay)
class BayAdmin(admin.ModelAdmin):
    list_display = ("id", "rackModule", "leftFrameIndex", "rightFrameIndex", "beamSpec", "isBeamSpecCustomized")
    search_fields = ("id", "rackModule__id", "beamSpec__id")
    list_filter = ("isBeamSpecCustomized",)


@admin.register(BeamLevel)
class BeamLevelAdmin(admin.ModelAdmin):
    list_display = ("id", "levelIndex", "holeIndex", "elevationIn", "beamSpec", "bay", "rackModule", "isBeamSpecCustomized")
    search_fields = ("id", "beamSpec__id", "bay__id", "rackModule__id")
    list_filter = ("isBeamSpecCustomized",)


@admin.register(Accessory)
class AccessoryAdmin(admin.ModelAdmin):
    list_display = ("id", "spec", "quantity", "targetBay", "targetLevelIndex", "designRevision")
    search_fields = ("id", "spec__id", "targetBay__id", "designRevision__id")
    list_filter = ("spec__category", "spec__scope")


@admin.register(RackModuleEntity)
class RackModuleEntityAdmin(admin.ModelAdmin):
    list_display = ("id", "domainId", "widthM", "depthM", "bayCount", "locked", "visible")
    search_fields = ("id", "domainId", "label")
    list_filter = ("locked", "visible")


@admin.register(RackLineEntity)
class RackLineEntityAdmin(admin.ModelAdmin):
    list_display = ("id", "domainId", "widthM", "depthM", "locked", "visible")
    search_fields = ("id", "domainId", "label")
    list_filter = ("locked", "visible")


@admin.register(WallEntity)
class WallEntityAdmin(admin.ModelAdmin):
    list_display = ("id", "lengthM", "thicknessM", "locked", "visible")
    search_fields = ("id", "label")
    list_filter = ("locked", "visible")


@admin.register(ColumnEntity)
class ColumnEntityAdmin(admin.ModelAdmin):
    list_display = ("id", "widthM", "depthM", "shape", "locked", "visible")
    search_fields = ("id", "label")
    list_filter = ("shape", "locked", "visible")


@admin.register(TextNoteEntity)
class TextNoteEntityAdmin(admin.ModelAdmin):
    list_display = ("id", "fontSizeM", "locked", "visible")
    search_fields = ("id", "text", "label")
    list_filter = ("locked", "visible")
