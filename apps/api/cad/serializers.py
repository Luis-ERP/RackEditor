from rest_framework import serializers

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


class FrameSpecSerializer(serializers.ModelSerializer):
    class Meta:
        model = FrameSpec
        fields = [
            "id",
            "heightIn",
            "depthIn",
            "beamSeparationIn",
            "gauge",
            "capacityClass",
            "uprightSeries",
            "compatibleConnectorTypes",
            "minimumTopClearanceIn",
            "basePlateType",
        ]


class BeamSpecSerializer(serializers.ModelSerializer):
    class Meta:
        model = BeamSpec
        fields = [
            "id",
            "lengthIn",
            "capacityClass",
            "beamSeries",
            "connectorType",
            "verticalEnvelopeIn",
            "profileHeightIn",
            "compatibleUprightSeries",
        ]


class BeamLevelSerializer(serializers.ModelSerializer):
    beamSpec = BeamSpecSerializer(read_only=True)

    class Meta:
        model = BeamLevel
        fields = [
            "id",
            "levelIndex",
            "holeIndex",
            "elevationIn",
            "beamSpec",
            "isBeamSpecCustomized",
        ]


class BaySerializer(serializers.ModelSerializer):
    beamSpec = BeamSpecSerializer(read_only=True)
    levels = BeamLevelSerializer(many=True, read_only=True)

    class Meta:
        model = Bay
        fields = [
            "id",
            "leftFrameIndex",
            "rightFrameIndex",
            "beamSpec",
            "isBeamSpecCustomized",
            "levels",
            "accessoryIds",
        ]


class FrameOverrideSerializer(serializers.ModelSerializer):
    frameSpec = FrameSpecSerializer(read_only=True)

    class Meta:
        model = FrameOverride
        fields = ["localFrameIndex", "frameSpec"]


class RackModuleSerializer(serializers.ModelSerializer):
    frameSpec = FrameSpecSerializer(read_only=True)
    bays = BaySerializer(many=True, read_only=True)
    levelUnion = BeamLevelSerializer(many=True, read_only=True)
    frameOverrides = serializers.SerializerMethodField()

    class Meta:
        model = RackModule
        fields = [
            "id",
            "frameSpec",
            "frameOverrides",
            "bays",
            "levelUnion",
            "frameCount",
            "startFrameIndex",
            "endFrameIndex",
            "rowIndex",
        ]

    def get_frameOverrides(self, obj):
        entries = obj.frameOverrideEntries.all().order_by("localFrameIndex")
        return {
            str(entry.localFrameIndex): FrameSpecSerializer(entry.frameSpec).data
            for entry in entries
        }


class RackLineSerializer(serializers.ModelSerializer):
    modules = RackModuleSerializer(many=True, read_only=True)

    class Meta:
        model = RackLine
        fields = [
            "id",
            "modules",
            "rowConfiguration",
            "levelMode",
            "backToBackConfig",
            "totalBayCount",
            "totalFrameCount",
            "validationState",
            "accessoryIds",
        ]


class AccessorySpecSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccessorySpec
        fields = ["id", "name", "category", "scope", "description"]


class AccessorySerializer(serializers.ModelSerializer):
    spec = AccessorySpecSerializer(read_only=True)
    targetBayId = serializers.CharField(source="targetBay_id", read_only=True)

    class Meta:
        model = Accessory
        fields = ["id", "spec", "quantity", "targetBayId", "targetLevelIndex"]


class FrameSerializer(serializers.ModelSerializer):
    spec = FrameSpecSerializer(read_only=True)

    class Meta:
        model = Frame
        fields = ["id", "spec", "positionIndex", "isCustomSpec", "rowIndex"]


class DesignRevisionSerializer(serializers.ModelSerializer):
    rackLines = RackLineSerializer(many=True, read_only=True)
    accessories = AccessorySerializer(many=True, read_only=True)

    class Meta:
        model = DesignRevision
        fields = [
            "id",
            "revisionNumber",
            "catalogVersion",
            "rackLines",
            "accessories",
            "validationResults",
            "bomSnapshot",
            "createdAt",
        ]


class RackModuleEntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = RackModuleEntity
        fields = [
            "id",
            "type",
            "transform",
            "domainId",
            "widthM",
            "depthM",
            "bayCount",
            "label",
            "locked",
            "visible",
        ]


class RackLineEntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = RackLineEntity
        fields = [
            "id",
            "type",
            "transform",
            "domainId",
            "widthM",
            "depthM",
            "label",
            "locked",
            "visible",
        ]


class WallEntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = WallEntity
        fields = [
            "id",
            "type",
            "transform",
            "lengthM",
            "thicknessM",
            "label",
            "locked",
            "visible",
        ]


class ColumnEntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = ColumnEntity
        fields = [
            "id",
            "type",
            "transform",
            "widthM",
            "depthM",
            "shape",
            "label",
            "locked",
            "visible",
        ]


class TextNoteEntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = TextNoteEntity
        fields = [
            "id",
            "type",
            "transform",
            "text",
            "fontSizeM",
            "label",
            "locked",
            "visible",
        ]
