from copy import deepcopy


def build_valid_cad_design_payload():
    return {
        "catalog": {
            "minimumFloorClearanceIn": 8,
            "minimumRowSpacerIn": 6,
            "nearCapacityThresholdPercent": 90,
            "nonStandardGapSteps": 18,
            "capacityClassOrder": ["LIGHT", "MEDIUM", "HEAVY"],
            "requiredDerivedAccessorySkus": [
                "ANCHOR-BOLT",
                "SAFETY-PIN",
                "BEAM-LOCK",
            ],
            "frameSpecs": [
                {
                    "id": "FRAME-144-42-MEDIUM",
                    "heightIn": 144,
                    "depthIn": 42,
                    "beamSeparationIn": 3,
                    "gauge": "14",
                    "capacityClass": "MEDIUM",
                    "uprightSeries": "TDROP",
                    "compatibleConnectorTypes": ["TEARDROP"],
                    "minimumTopClearanceIn": 6,
                    "basePlateType": "STANDARD",
                },
                {
                    "id": "FRAME-144-36-MEDIUM",
                    "heightIn": 144,
                    "depthIn": 36,
                    "beamSeparationIn": 3,
                    "gauge": "14",
                    "capacityClass": "MEDIUM",
                    "uprightSeries": "TDROP",
                    "compatibleConnectorTypes": ["TEARDROP"],
                    "minimumTopClearanceIn": 6,
                    "basePlateType": "STANDARD",
                },
                {
                    "id": "FRAME-144-42-LIGHT",
                    "heightIn": 144,
                    "depthIn": 42,
                    "beamSeparationIn": 3,
                    "gauge": "16",
                    "capacityClass": "LIGHT",
                    "uprightSeries": "TDROP",
                    "compatibleConnectorTypes": ["TEARDROP"],
                    "minimumTopClearanceIn": 6,
                    "basePlateType": "STANDARD",
                },
                {
                    "id": "FRAME-144-42-ROUND",
                    "heightIn": 144,
                    "depthIn": 42,
                    "beamSeparationIn": 3,
                    "gauge": "14",
                    "capacityClass": "MEDIUM",
                    "uprightSeries": "ROUND",
                    "compatibleConnectorTypes": ["ROUND-HOOK"],
                    "minimumTopClearanceIn": 6,
                    "basePlateType": "STANDARD",
                },
            ],
            "beamSpecs": [
                {
                    "id": "BEAM-96-MEDIUM",
                    "lengthIn": 96,
                    "capacityClass": "MEDIUM",
                    "beamSeries": "BOX",
                    "connectorType": "TEARDROP",
                    "verticalEnvelopeIn": 4,
                    "profileHeightIn": 5,
                    "compatibleUprightSeries": ["TDROP"],
                },
                {
                    "id": "BEAM-96-HEAVY",
                    "lengthIn": 96,
                    "capacityClass": "HEAVY",
                    "beamSeries": "BOX",
                    "connectorType": "TEARDROP",
                    "verticalEnvelopeIn": 4,
                    "profileHeightIn": 5,
                    "compatibleUprightSeries": ["TDROP"],
                },
                {
                    "id": "BEAM-96-ROUND",
                    "lengthIn": 96,
                    "capacityClass": "MEDIUM",
                    "beamSeries": "BOX",
                    "connectorType": "ROUND-HOOK",
                    "verticalEnvelopeIn": 4,
                    "profileHeightIn": 5,
                    "compatibleUprightSeries": ["ROUND"],
                },
                {
                    "id": "BEAM-48-MEDIUM",
                    "lengthIn": 48,
                    "capacityClass": "MEDIUM",
                    "beamSeries": "BOX",
                    "connectorType": "TEARDROP",
                    "verticalEnvelopeIn": 4,
                    "profileHeightIn": 5,
                    "compatibleUprightSeries": ["TDROP"],
                },
                {
                    "id": "BEAM-96-TALL-ENVELOPE",
                    "lengthIn": 96,
                    "capacityClass": "MEDIUM",
                    "beamSeries": "BOX",
                    "connectorType": "TEARDROP",
                    "verticalEnvelopeIn": 10,
                    "profileHeightIn": 5,
                    "compatibleUprightSeries": ["TDROP"],
                },
                {
                    "id": "BEAM-96-DEEP-PROFILE",
                    "lengthIn": 96,
                    "capacityClass": "MEDIUM",
                    "beamSeries": "CHANNEL",
                    "connectorType": "TEARDROP",
                    "verticalEnvelopeIn": 4,
                    "profileHeightIn": 8,
                    "compatibleUprightSeries": ["TDROP"],
                },
            ],
        },
        "designRevision": {
            "id": "design-revision-valid",
            "revisionNumber": 1,
            "catalogVersion": "rack-catalog-v1",
            "bomSnapshot": {
                "generatedAt": "2026-03-17T00:00:00Z",
                "catalogVersion": "rack-catalog-v1",
                "items": [
                    {"sku": "ANCHOR-BOLT", "name": "Anchor Bolt", "quantity": 6, "rule": "DERIVED"},
                    {"sku": "SAFETY-PIN", "name": "Safety Pin", "quantity": 8, "rule": "DERIVED"},
                    {"sku": "BEAM-LOCK", "name": "Beam Lock", "quantity": 8, "rule": "DERIVED"},
                ],
            },
            "rackLines": [
                {
                    "id": "line-single-valid",
                    "rowConfiguration": "SINGLE",
                    "backToBackConfig": None,
                    "frames": [
                        {"id": "frame-0", "specId": "FRAME-144-42-MEDIUM"},
                        {"id": "frame-1", "specId": "FRAME-144-42-MEDIUM"},
                        {"id": "frame-2", "specId": "FRAME-144-42-MEDIUM"},
                    ],
                    "modules": [
                        {
                            "id": "module-0",
                            "startFrameIndex": 0,
                            "endFrameIndex": 2,
                            "rowIndex": 0,
                            "bays": [
                                {
                                    "id": "bay-0",
                                    "widthIn": 96,
                                    "beamLevels": [
                                        {"id": "bay-0-level-0", "levelIndex": 0, "holeIndex": 6, "specId": "BEAM-96-MEDIUM", "usagePercent": 60},
                                        {"id": "bay-0-level-1", "levelIndex": 1, "holeIndex": 16, "specId": "BEAM-96-MEDIUM", "usagePercent": 60},
                                    ],
                                    "accessoryIds": [],
                                },
                                {
                                    "id": "bay-1",
                                    "widthIn": 96,
                                    "beamLevels": [
                                        {"id": "bay-1-level-0", "levelIndex": 0, "holeIndex": 6, "specId": "BEAM-96-MEDIUM", "usagePercent": 60},
                                        {"id": "bay-1-level-1", "levelIndex": 1, "holeIndex": 16, "specId": "BEAM-96-MEDIUM", "usagePercent": 60},
                                    ],
                                    "accessoryIds": [],
                                },
                            ],
                        }
                    ],
                    "validationState": "VALID",
                    "accessoryIds": [],
                }
            ],
            "accessories": [],
            "validationResults": {},
        },
    }


def build_valid_back_to_back_cad_design_payload():
    payload = build_valid_cad_design_payload()
    payload["designRevision"]["id"] = "design-revision-b2b-valid"
    payload["designRevision"]["rackLines"] = [
        {
            "id": "line-b2b-valid",
            "rowConfiguration": "BACK_TO_BACK_2",
            "backToBackConfig": {
                "rowCount": 2,
                "rowSpacerSizeIn": 8,
            },
            "frames": [
                {"id": "frame-0", "specId": "FRAME-144-42-MEDIUM", "rowIndex": 0},
                {"id": "frame-1", "specId": "FRAME-144-42-MEDIUM", "rowIndex": 0},
                {"id": "frame-2", "specId": "FRAME-144-36-MEDIUM", "rowIndex": 1},
                {"id": "frame-3", "specId": "FRAME-144-36-MEDIUM", "rowIndex": 1},
            ],
            "modules": [
                {
                    "id": "module-row-0",
                    "startFrameIndex": 0,
                    "endFrameIndex": 1,
                    "rowIndex": 0,
                    "bays": [
                        {
                            "id": "bay-row-0",
                            "widthIn": 96,
                            "beamLevels": [
                                {"id": "bay-row-0-level-0", "levelIndex": 0, "holeIndex": 6, "specId": "BEAM-96-MEDIUM", "usagePercent": 60},
                            ],
                            "accessoryIds": [],
                        }
                    ],
                },
                {
                    "id": "module-row-1",
                    "startFrameIndex": 2,
                    "endFrameIndex": 3,
                    "rowIndex": 1,
                    "bays": [
                        {
                            "id": "bay-row-1",
                            "widthIn": 96,
                            "beamLevels": [
                                {"id": "bay-row-1-level-0", "levelIndex": 0, "holeIndex": 6, "specId": "BEAM-96-MEDIUM", "usagePercent": 60},
                            ],
                            "accessoryIds": [],
                        }
                    ],
                },
            ],
            "validationState": "VALID",
            "accessoryIds": [],
        }
    ]
    return payload


def build_valid_multi_module_cad_design_payload():
    payload = build_valid_cad_design_payload()
    payload["designRevision"]["id"] = "design-revision-multi-module-valid"
    payload["designRevision"]["rackLines"][0]["frames"] = [
        {"id": "frame-0", "specId": "FRAME-144-42-MEDIUM"},
        {"id": "frame-1", "specId": "FRAME-144-42-MEDIUM"},
        {"id": "frame-2", "specId": "FRAME-144-42-MEDIUM"},
        {"id": "frame-3", "specId": "FRAME-144-42-MEDIUM"},
    ]
    payload["designRevision"]["rackLines"][0]["modules"] = [
        {
            "id": "module-0",
            "startFrameIndex": 0,
            "endFrameIndex": 1,
            "rowIndex": 0,
            "bays": [
                {
                    "id": "bay-0",
                    "widthIn": 96,
                    "beamLevels": [
                        {"id": "bay-0-level-0", "levelIndex": 0, "holeIndex": 6, "specId": "BEAM-96-MEDIUM", "usagePercent": 60},
                    ],
                    "accessoryIds": [],
                }
            ],
        },
        {
            "id": "module-1",
            "startFrameIndex": 1,
            "endFrameIndex": 3,
            "rowIndex": 0,
            "bays": [
                {
                    "id": "bay-1",
                    "widthIn": 96,
                    "beamLevels": [
                        {"id": "bay-1-level-0", "levelIndex": 0, "holeIndex": 6, "specId": "BEAM-96-MEDIUM", "usagePercent": 60},
                    ],
                    "accessoryIds": [],
                },
                {
                    "id": "bay-2",
                    "widthIn": 96,
                    "beamLevels": [
                        {"id": "bay-2-level-0", "levelIndex": 0, "holeIndex": 6, "specId": "BEAM-96-MEDIUM", "usagePercent": 60},
                    ],
                    "accessoryIds": [],
                },
            ],
        },
    ]
    return payload


def clone_payload(payload):
    return deepcopy(payload)
