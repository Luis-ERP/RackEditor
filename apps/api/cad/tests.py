from django.test import SimpleTestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import User
from .models import DesignRevision
from .test_helpers import (
    build_valid_back_to_back_cad_design_payload,
    build_valid_cad_design_payload,
    build_valid_multi_module_cad_design_payload,
    clone_payload,
)
from .validators import validate_cad_design


class CadDesignValidationTests(SimpleTestCase):
    maxDiff = None

    def assert_line_state(self, result, expected_state, error_codes=None, incomplete_codes=None, warning_codes=None):
        rack_line_result = result["rackLines"][0]
        self.assertEqual(rack_line_result["validationState"], expected_state)

        actual_error_codes = {issue["code"] for issue in rack_line_result["errors"]}
        actual_incomplete_codes = {issue["code"] for issue in rack_line_result["incompletes"]}
        actual_warning_codes = {issue["code"] for issue in rack_line_result["warnings"]}

        if error_codes is not None:
            self.assertEqual(actual_error_codes, set(error_codes))
        if incomplete_codes is not None:
            self.assertEqual(actual_incomplete_codes, set(incomplete_codes))
        if warning_codes is not None:
            self.assertEqual(actual_warning_codes, set(warning_codes))

    def validate(self, payload):
        return validate_cad_design(payload)

    def assert_line_contains(self, result, expected_state, error_codes=None, incomplete_codes=None, warning_codes=None):
        rack_line_result = result["rackLines"][0]
        self.assertEqual(rack_line_result["validationState"], expected_state)

        actual_error_codes = {issue["code"] for issue in rack_line_result["errors"]}
        actual_incomplete_codes = {issue["code"] for issue in rack_line_result["incompletes"]}
        actual_warning_codes = {issue["code"] for issue in rack_line_result["warnings"]}

        if error_codes is not None:
            self.assertTrue(set(error_codes).issubset(actual_error_codes), f"Missing expected error codes {set(error_codes) - actual_error_codes}; actual={actual_error_codes}")
        if incomplete_codes is not None:
            self.assertTrue(set(incomplete_codes).issubset(actual_incomplete_codes), f"Missing expected incomplete codes {set(incomplete_codes) - actual_incomplete_codes}; actual={actual_incomplete_codes}")
        if warning_codes is not None:
            self.assertTrue(set(warning_codes).issubset(actual_warning_codes), f"Missing expected warning codes {set(warning_codes) - actual_warning_codes}; actual={actual_warning_codes}")

    def test_valid_single_row_design_passes(self):
        payload = build_valid_cad_design_payload()

        result = self.validate(payload)

        self.assertEqual(result["validationState"], "VALID")
        self.assert_line_state(result, "VALID", error_codes=set(), incomplete_codes=set(), warning_codes=set())

    def test_bay_requirements_cover_valid_flow_and_breakages(self):
        valid_payload = build_valid_cad_design_payload()
        self.assert_line_state(self.validate(valid_payload), "VALID", error_codes=set(), incomplete_codes=set(), warning_codes=set())

        no_levels_payload = clone_payload(valid_payload)
        no_levels_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"] = []
        self.assert_line_state(
            self.validate(no_levels_payload),
            "INCOMPLETE",
            error_codes=set(),
            incomplete_codes={"BAY_MISSING_BEAM_LEVELS"},
            warning_codes=set(),
        )

        width_not_in_catalog_payload = clone_payload(valid_payload)
        width_not_in_catalog_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["widthIn"] = 97.5
        self.assert_line_state(
            self.validate(width_not_in_catalog_payload),
            "INVALID",
            error_codes={"BAY_WIDTH_NOT_IN_CATALOG", "BEAM_LENGTH_MISMATCH"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

        invalid_width_payload = clone_payload(valid_payload)
        invalid_width_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["widthIn"] = 0
        self.assert_line_state(
            self.validate(invalid_width_payload),
            "INVALID",
            error_codes={"BAY_WIDTH_INVALID"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

    def test_beam_compatibility_rules_cover_valid_flow_and_breakages(self):
        valid_payload = build_valid_cad_design_payload()
        self.assert_line_state(self.validate(valid_payload), "VALID", error_codes=set(), incomplete_codes=set(), warning_codes=set())

        series_mismatch_payload = clone_payload(valid_payload)
        series_mismatch_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][0]["specId"] = "BEAM-96-ROUND"
        self.assert_line_state(
            self.validate(series_mismatch_payload),
            "INVALID",
            error_codes={"BEAM_UPRIGHT_SERIES_MISMATCH", "BEAM_CONNECTOR_TYPE_MISMATCH"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

        connector_mismatch_payload = clone_payload(valid_payload)
        connector_mismatch_payload["catalog"]["beamSpecs"].append(
            {
                "id": "BEAM-96-TDROP-BAD-CONNECTOR",
                "lengthIn": 96,
                "capacityClass": "MEDIUM",
                "beamSeries": "BOX",
                "connectorType": "ROUND-HOOK",
                "verticalEnvelopeIn": 4,
                "profileHeightIn": 5,
                "compatibleUprightSeries": ["TDROP"],
            }
        )
        connector_mismatch_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][0]["specId"] = "BEAM-96-TDROP-BAD-CONNECTOR"
        self.assert_line_state(
            self.validate(connector_mismatch_payload),
            "INVALID",
            error_codes={"BEAM_CONNECTOR_TYPE_MISMATCH"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

        capacity_mismatch_payload = clone_payload(valid_payload)
        for frame in capacity_mismatch_payload["designRevision"]["rackLines"][0]["frames"][:2]:
            frame["specId"] = "FRAME-144-42-LIGHT"
        capacity_mismatch_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][0]["specId"] = "BEAM-96-HEAVY"
        self.assert_line_state(
            self.validate(capacity_mismatch_payload),
            "INVALID",
            error_codes={"BEAM_CAPACITY_EXCEEDS_FRAME"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

        length_mismatch_payload = clone_payload(valid_payload)
        length_mismatch_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][0]["specId"] = "BEAM-48-MEDIUM"
        self.assert_line_state(
            self.validate(length_mismatch_payload),
            "INVALID",
            error_codes={"BEAM_LENGTH_MISMATCH"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

    def test_level_rules_cover_valid_flow_and_breakages(self):
        valid_payload = build_valid_cad_design_payload()
        self.assert_line_state(self.validate(valid_payload), "VALID", error_codes=set(), incomplete_codes=set(), warning_codes=set())

        level_index_gap_payload = clone_payload(valid_payload)
        level_index_gap_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][1]["levelIndex"] = 2
        self.assert_line_state(
            self.validate(level_index_gap_payload),
            "INVALID",
            error_codes={"LEVEL_INDEX_NOT_CONSECUTIVE"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

        negative_hole_index_payload = clone_payload(valid_payload)
        negative_hole_index_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][0]["holeIndex"] = -1
        self.assert_line_state(
            self.validate(negative_hole_index_payload),
            "INVALID",
            error_codes={"LEVEL_HOLE_INDEX_INVALID"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

        fractional_hole_index_payload = clone_payload(valid_payload)
        fractional_hole_index_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][0]["holeIndex"] = 3.5
        self.assert_line_state(
            self.validate(fractional_hole_index_payload),
            "INVALID",
            error_codes={"LEVEL_HOLE_INDEX_INVALID"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

        ordering_break_payload = clone_payload(valid_payload)
        ordering_break_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][1]["holeIndex"] = 6
        self.assert_line_state(
            self.validate(ordering_break_payload),
            "INVALID",
            error_codes={"LEVEL_ORDER_INVALID", "LEVEL_SPACING_TOO_TIGHT"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

        spacing_break_payload = clone_payload(valid_payload)
        spacing_break_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][0]["specId"] = "BEAM-96-DEEP-PROFILE"
        spacing_break_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][1]["holeIndex"] = 12
        self.assert_line_state(
            self.validate(spacing_break_payload),
            "INVALID",
            error_codes={"LEVEL_SPACING_TOO_TIGHT"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

        top_clearance_break_payload = clone_payload(valid_payload)
        top_clearance_break_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][1]["holeIndex"] = 70
        self.assert_line_state(
            self.validate(top_clearance_break_payload),
            "INVALID",
            error_codes={"LEVEL_EXCEEDS_FRAME_HEIGHT"},
            incomplete_codes=set(),
            warning_codes={"NON_STANDARD_LEVEL_SPACING"},
        )

        floor_clearance_break_payload = clone_payload(valid_payload)
        floor_clearance_break_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][0]["holeIndex"] = 3
        self.assert_line_state(
            self.validate(floor_clearance_break_payload),
            "INVALID",
            error_codes={"FIRST_LEVEL_BELOW_FLOOR_CLEARANCE"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

        connector_below_grade_payload = clone_payload(valid_payload)
        connector_below_grade_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][0]["holeIndex"] = 4
        connector_below_grade_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][0]["specId"] = "BEAM-96-TALL-ENVELOPE"
        self.assert_line_state(
            self.validate(connector_below_grade_payload),
            "INVALID",
            error_codes={"FIRST_LEVEL_CONNECTOR_BELOW_GRADE"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

    def test_module_coverage_rules_cover_valid_flow_and_breakages(self):
        valid_payload = build_valid_multi_module_cad_design_payload()
        self.assert_line_state(self.validate(valid_payload), "VALID", error_codes=set(), incomplete_codes=set(), warning_codes=set())

        out_of_bounds_payload = clone_payload(valid_payload)
        out_of_bounds_payload["designRevision"]["rackLines"][0]["modules"][1]["startFrameIndex"] = 3
        self.assert_line_state(
            self.validate(out_of_bounds_payload),
            "INVALID",
            error_codes={"MODULE_FRAME_RANGE_OUT_OF_BOUNDS", "MODULE_CONTINUITY_BROKEN"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

        gap_payload = clone_payload(valid_payload)
        gap_payload["designRevision"]["rackLines"][0]["modules"][1]["startFrameIndex"] = 2
        self.assert_line_state(
            self.validate(gap_payload),
            "INVALID",
            error_codes={"MODULE_CONTINUITY_BROKEN", "MODULE_FRAME_RANGE_OUT_OF_BOUNDS"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

        overlap_payload = clone_payload(valid_payload)
        overlap_payload["designRevision"]["rackLines"][0]["modules"][1]["startFrameIndex"] = 0
        self.assert_line_state(
            self.validate(overlap_payload),
            "INVALID",
            error_codes={"MODULE_CONTINUITY_BROKEN"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

        empty_module_payload = clone_payload(valid_payload)
        empty_module_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"] = []
        self.assert_line_state(
            self.validate(empty_module_payload),
            "INVALID",
            error_codes={"MODULE_HAS_NO_BAYS", "MODULE_CONTINUITY_BROKEN"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

    def test_back_to_back_rules_cover_valid_flow_and_breakages(self):
        valid_payload = build_valid_back_to_back_cad_design_payload()
        self.assert_line_state(self.validate(valid_payload), "VALID", error_codes=set(), incomplete_codes=set(), warning_codes=set())

        missing_config_payload = clone_payload(valid_payload)
        missing_config_payload["designRevision"]["rackLines"][0]["backToBackConfig"] = None
        self.assert_line_state(
            self.validate(missing_config_payload),
            "INVALID",
            error_codes={"BACK_TO_BACK_CONFIG_REQUIRED"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

        row_count_mismatch_payload = clone_payload(valid_payload)
        row_count_mismatch_payload["designRevision"]["rackLines"][0]["backToBackConfig"]["rowCount"] = 3
        self.assert_line_state(
            self.validate(row_count_mismatch_payload),
            "INVALID",
            error_codes={"ROW_COUNT_MISMATCH"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

        missing_row_index_payload = clone_payload(valid_payload)
        del missing_row_index_payload["designRevision"]["rackLines"][0]["frames"][0]["rowIndex"]
        self.assert_line_state(
            self.validate(missing_row_index_payload),
            "INVALID",
            error_codes={"FRAME_ROW_INDEX_REQUIRED", "BAY_FRAME_REFERENCE_OUT_OF_BOUNDS", "MODULE_CONTINUITY_BROKEN"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

        out_of_range_row_index_payload = clone_payload(valid_payload)
        out_of_range_row_index_payload["designRevision"]["rackLines"][0]["frames"][0]["rowIndex"] = 2
        self.assert_line_state(
            self.validate(out_of_range_row_index_payload),
            "INVALID",
            error_codes={"FRAME_ROW_INDEX_OUT_OF_RANGE", "BAY_FRAME_REFERENCE_OUT_OF_BOUNDS", "MODULE_CONTINUITY_BROKEN"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

        row_depth_break_payload = clone_payload(valid_payload)
        row_depth_break_payload["designRevision"]["rackLines"][0]["frames"][1]["specId"] = "FRAME-144-36-MEDIUM"
        self.assert_line_state(
            self.validate(row_depth_break_payload),
            "INVALID",
            error_codes={"FRAME_DEPTH_NOT_UNIFORM_WITHIN_ROW"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

        spanning_module_payload = clone_payload(valid_payload)
        spanning_module_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"].append(
            {
                "id": "extra-bay",
                "widthIn": 96,
                "beamLevels": [
                    {"id": "extra-level", "levelIndex": 1, "holeIndex": 16, "specId": "BEAM-96-MEDIUM", "usagePercent": 60},
                ],
                "accessoryIds": [],
            }
        )
        spanning_module_payload["designRevision"]["rackLines"][0]["modules"][0]["endFrameIndex"] = 2
        self.assert_line_state(
            self.validate(spanning_module_payload),
            "INVALID",
            error_codes={"MODULE_SPANS_MULTIPLE_ROWS", "MODULE_CONTINUITY_BROKEN"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

        spacer_below_minimum_payload = clone_payload(valid_payload)
        spacer_below_minimum_payload["designRevision"]["rackLines"][0]["backToBackConfig"]["rowSpacerSizeIn"] = 4
        self.assert_line_state(
            self.validate(spacer_below_minimum_payload),
            "INVALID",
            error_codes={"ROW_SPACER_BELOW_MINIMUM"},
            incomplete_codes=set(),
            warning_codes=set(),
        )

    def test_bom_and_derived_accessory_requirements_cover_valid_flow_and_breakages(self):
        valid_payload = build_valid_cad_design_payload()
        self.assert_line_state(self.validate(valid_payload), "VALID", error_codes=set(), incomplete_codes=set(), warning_codes=set())

        missing_bom_payload = clone_payload(valid_payload)
        missing_bom_payload["designRevision"]["bomSnapshot"] = None
        self.assert_line_state(
            self.validate(missing_bom_payload),
            "INCOMPLETE",
            error_codes=set(),
            incomplete_codes={"BOM_SNAPSHOT_MISSING"},
            warning_codes=set(),
        )

        missing_derived_accessory_payload = clone_payload(valid_payload)
        missing_derived_accessory_payload["designRevision"]["bomSnapshot"]["items"] = [
            {"sku": "ANCHOR-BOLT", "name": "Anchor Bolt", "quantity": 6, "rule": "DERIVED"},
        ]
        self.assert_line_state(
            self.validate(missing_derived_accessory_payload),
            "INCOMPLETE",
            error_codes=set(),
            incomplete_codes={"MISSING_DERIVED_ACCESSORY"},
            warning_codes=set(),
        )

    def test_warning_rules_cover_valid_flow_and_breakages(self):
        valid_payload = build_valid_cad_design_payload()
        self.assert_line_state(self.validate(valid_payload), "VALID", error_codes=set(), incomplete_codes=set(), warning_codes=set())

        near_capacity_payload = clone_payload(valid_payload)
        near_capacity_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][0]["usagePercent"] = 95
        self.assert_line_state(
            self.validate(near_capacity_payload),
            "VALID_WITH_WARNINGS",
            error_codes=set(),
            incomplete_codes=set(),
            warning_codes={"NEAR_CAPACITY_USAGE"},
        )

        non_standard_spacing_payload = clone_payload(valid_payload)
        non_standard_spacing_payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][1]["holeIndex"] = 30
        self.assert_line_state(
            self.validate(non_standard_spacing_payload),
            "VALID_WITH_WARNINGS",
            error_codes=set(),
            incomplete_codes=set(),
            warning_codes={"NON_STANDARD_LEVEL_SPACING"},
        )


    def test_additional_valid_design_shapes_pass(self):
        cases = [
            ("single bay single level", self._valid_single_bay_single_level_payload()),
            ("minimum spacing boundary", self._valid_minimum_spacing_boundary_payload()),
            ("top clearance boundary", self._valid_top_clearance_boundary_payload()),
            ("floor clearance boundary", self._valid_floor_clearance_boundary_payload()),
            ("connector envelope boundary", self._valid_connector_envelope_boundary_payload()),
            ("three level bay", self._valid_three_level_bay_payload()),
            ("mixed frame heights same depth", self._valid_mixed_frame_heights_payload()),
            ("multi module shared frame", build_valid_multi_module_cad_design_payload()),
            ("back to back two rows", build_valid_back_to_back_cad_design_payload()),
            ("back to back three rows", self._valid_back_to_back_three_rows_payload()),
        ]

        for label, payload in cases:
            with self.subTest(label=label):
                self.assert_line_state(
                    self.validate(payload),
                    "VALID",
                    error_codes=set(),
                    incomplete_codes=set(),
                    warning_codes=set(),
                )

    def test_additional_invalid_design_shapes_are_rejected(self):
        cases = [
            (
                "invalid row configuration",
                self._payload_with_invalid_row_configuration(),
                "INVALID",
                {"INVALID_ROW_CONFIGURATION"},
            ),
            (
                "too few frames",
                self._payload_with_too_few_frames(),
                "INVALID",
                {"FRAME_COUNT_INVALID"},
            ),
            (
                "unknown frame spec",
                self._payload_with_unknown_frame_spec(),
                "INVALID",
                {"UNKNOWN_FRAME_SPEC"},
            ),
            (
                "unknown beam spec",
                self._payload_with_unknown_beam_spec(),
                "INVALID",
                {"UNKNOWN_BEAM_SPEC"},
            ),
            (
                "negative module start frame index",
                self._payload_with_negative_module_start_index(),
                "INVALID",
                {"MODULE_START_INDEX_INVALID"},
            ),
            (
                "boolean module start frame index",
                self._payload_with_boolean_module_start_index(),
                "INVALID",
                {"MODULE_START_INDEX_INVALID"},
            ),
            (
                "module row index mismatch",
                self._payload_with_module_row_index_mismatch(),
                "INVALID",
                {"MODULE_ROW_INDEX_MISMATCH"},
            ),
            (
                "non numeric row spacer size",
                self._payload_with_non_numeric_row_spacer_size(),
                "INVALID",
                {"ROW_SPACER_BELOW_MINIMUM"},
            ),
            (
                "boolean frame row index",
                self._payload_with_boolean_frame_row_index(),
                "INVALID",
                {"FRAME_ROW_INDEX_OUT_OF_RANGE"},
            ),
            (
                "boolean hole index",
                self._payload_with_boolean_hole_index(),
                "INVALID",
                {"LEVEL_HOLE_INDEX_INVALID"},
            ),
        ]

        for label, payload, expected_state, expected_error_codes in cases:
            with self.subTest(label=label):
                self.assert_line_contains(
                    self.validate(payload),
                    expected_state,
                    error_codes=expected_error_codes,
                    incomplete_codes=set(),
                )

    def _payload_with_invalid_row_configuration(self):
        payload = build_valid_cad_design_payload()
        payload["designRevision"]["rackLines"][0]["rowConfiguration"] = "DOUBLE_WIDE"
        return payload

    def _payload_with_too_few_frames(self):
        payload = build_valid_cad_design_payload()
        payload["designRevision"]["rackLines"][0]["frames"] = [
            {"id": "frame-0", "specId": "FRAME-144-42-MEDIUM"},
        ]
        return payload

    def _payload_with_unknown_frame_spec(self):
        payload = build_valid_cad_design_payload()
        payload["designRevision"]["rackLines"][0]["frames"][1]["specId"] = "FRAME-DOES-NOT-EXIST"
        return payload

    def _payload_with_unknown_beam_spec(self):
        payload = build_valid_cad_design_payload()
        payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][0]["specId"] = "BEAM-DOES-NOT-EXIST"
        return payload

    def _payload_with_negative_module_start_index(self):
        payload = build_valid_cad_design_payload()
        payload["designRevision"]["rackLines"][0]["modules"][0]["startFrameIndex"] = -1
        return payload

    def _payload_with_boolean_module_start_index(self):
        payload = build_valid_cad_design_payload()
        payload["designRevision"]["rackLines"][0]["modules"][0]["startFrameIndex"] = True
        return payload

    def _payload_with_module_row_index_mismatch(self):
        payload = build_valid_back_to_back_cad_design_payload()
        payload["designRevision"]["rackLines"][0]["modules"][0]["rowIndex"] = 1
        return payload

    def _payload_with_non_numeric_row_spacer_size(self):
        payload = build_valid_back_to_back_cad_design_payload()
        payload["designRevision"]["rackLines"][0]["backToBackConfig"]["rowSpacerSizeIn"] = "narrow"
        return payload

    def _payload_with_boolean_frame_row_index(self):
        payload = build_valid_back_to_back_cad_design_payload()
        payload["designRevision"]["rackLines"][0]["frames"][0]["rowIndex"] = True
        return payload

    def _payload_with_boolean_hole_index(self):
        payload = build_valid_cad_design_payload()
        payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][0]["holeIndex"] = True
        return payload

    def _valid_single_bay_single_level_payload(self):
        payload = build_valid_cad_design_payload()
        payload["designRevision"]["rackLines"][0]["frames"] = [
            {"id": "frame-0", "specId": "FRAME-144-42-MEDIUM"},
            {"id": "frame-1", "specId": "FRAME-144-42-MEDIUM"},
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
            }
        ]
        return payload

    def _valid_minimum_spacing_boundary_payload(self):
        payload = self._valid_single_bay_single_level_payload()
        payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"] = [
            {"id": "bay-0-level-0", "levelIndex": 0, "holeIndex": 6, "specId": "BEAM-96-MEDIUM", "usagePercent": 60},
            {"id": "bay-0-level-1", "levelIndex": 1, "holeIndex": 12, "specId": "BEAM-96-MEDIUM", "usagePercent": 60},
        ]
        return payload

    def _valid_top_clearance_boundary_payload(self):
        payload = self._valid_single_bay_single_level_payload()
        payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][0]["holeIndex"] = 69
        return payload

    def _valid_floor_clearance_boundary_payload(self):
        payload = self._valid_single_bay_single_level_payload()
        payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][0]["holeIndex"] = 4
        return payload

    def _valid_connector_envelope_boundary_payload(self):
        payload = self._valid_single_bay_single_level_payload()
        payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][0]["holeIndex"] = 5
        payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"][0]["specId"] = "BEAM-96-TALL-ENVELOPE"
        return payload

    def _valid_three_level_bay_payload(self):
        payload = self._valid_single_bay_single_level_payload()
        payload["designRevision"]["rackLines"][0]["modules"][0]["bays"][0]["beamLevels"] = [
            {"id": "bay-0-level-0", "levelIndex": 0, "holeIndex": 6, "specId": "BEAM-96-MEDIUM", "usagePercent": 60},
            {"id": "bay-0-level-1", "levelIndex": 1, "holeIndex": 16, "specId": "BEAM-96-MEDIUM", "usagePercent": 60},
            {"id": "bay-0-level-2", "levelIndex": 2, "holeIndex": 26, "specId": "BEAM-96-MEDIUM", "usagePercent": 60},
        ]
        return payload

    def _valid_mixed_frame_heights_payload(self):
        payload = build_valid_cad_design_payload()
        payload["catalog"]["frameSpecs"].append(
            {
                "id": "FRAME-120-42-MEDIUM",
                "heightIn": 120,
                "depthIn": 42,
                "beamSeparationIn": 3,
                "gauge": "14",
                "capacityClass": "MEDIUM",
                "uprightSeries": "TDROP",
                "compatibleConnectorTypes": ["TEARDROP"],
                "minimumTopClearanceIn": 6,
                "basePlateType": "STANDARD",
            }
        )
        payload["designRevision"]["rackLines"][0]["frames"] = [
            {"id": "frame-0", "specId": "FRAME-120-42-MEDIUM"},
            {"id": "frame-1", "specId": "FRAME-144-42-MEDIUM"},
            {"id": "frame-2", "specId": "FRAME-120-42-MEDIUM"},
        ]
        payload["designRevision"]["rackLines"][0]["modules"][0]["bays"] = [
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
        ]
        return payload

    def _valid_back_to_back_three_rows_payload(self):
        payload = build_valid_cad_design_payload()
        payload["designRevision"]["id"] = "design-revision-b2b-3-valid"
        payload["designRevision"]["rackLines"] = [
            {
                "id": "line-b2b-3-valid",
                "rowConfiguration": "BACK_TO_BACK_3",
                "backToBackConfig": {
                    "rowCount": 3,
                    "rowSpacerSizeIn": 8,
                },
                "frames": [
                    {"id": "frame-0", "specId": "FRAME-144-42-MEDIUM", "rowIndex": 0},
                    {"id": "frame-1", "specId": "FRAME-144-42-MEDIUM", "rowIndex": 0},
                    {"id": "frame-2", "specId": "FRAME-144-36-MEDIUM", "rowIndex": 1},
                    {"id": "frame-3", "specId": "FRAME-144-36-MEDIUM", "rowIndex": 1},
                    {"id": "frame-4", "specId": "FRAME-144-42-MEDIUM", "rowIndex": 2},
                    {"id": "frame-5", "specId": "FRAME-144-42-MEDIUM", "rowIndex": 2},
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
                    {
                        "id": "module-row-2",
                        "startFrameIndex": 4,
                        "endFrameIndex": 5,
                        "rowIndex": 2,
                        "bays": [
                            {
                                "id": "bay-row-2",
                                "widthIn": 96,
                                "beamLevels": [
                                    {"id": "bay-row-2-level-0", "levelIndex": 0, "holeIndex": 6, "specId": "BEAM-96-MEDIUM", "usagePercent": 60},
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


class DesignRevisionSubmitViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="cad@example.com", password="secret123")
        self.client.force_authenticate(self.user)

    def test_submit_design_revision_persists_project_document_and_bom(self):
        payload = {
            "source": "CAD_EDITOR",
            "exportedAt": "2026-03-18T12:00:00Z",
            "designId": "cad-live-design",
            "designRevisionId": "cad-revision-2026-03-18T12:00:00Z",
            "bomSnapshot": {
                "catalogVersion": "rack-catalog-lists-v1",
                "generatedAt": "2026-03-18T12:00:00Z",
                "items": [
                    {
                        "sku": "FRAME-144-42-MEDIUM",
                        "name": "Frame 144\" x 42\" (TDROP)",
                        "quantity": 2,
                        "unit": "ea",
                        "rule": "frame_count=2",
                    }
                ],
            },
            "projectDocument": {
                "documentType": "rack-editor-project",
                "schemaVersion": "1.0.0",
                "layout": {"entities": []},
                "semantics": {"rackDomain": {"modules": []}},
                "canvas": {"darkMode": False},
            },
            "stats": {"lineCount": 1, "totalQuantity": 2},
        }

        response = self.client.post(reverse("cad_design_revision_submit"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(DesignRevision.objects.count(), 1)

        revision = DesignRevision.objects.get(id=payload["designRevisionId"])
        self.assertEqual(revision.catalogVersion, "rack-catalog-lists-v1")
        self.assertEqual(revision.projectDocument, payload["projectDocument"])
        self.assertEqual(revision.bomSnapshot, payload["bomSnapshot"])
        self.assertEqual(revision.validationResults["submission"]["designId"], "cad-live-design")

    def test_submit_design_revision_allows_anonymous_access(self):
        self.client.force_authenticate(None)

        response = self.client.post(
            reverse("cad_design_revision_submit"),
            {
                "designRevisionId": "cad-revision-unauthorized",
                "projectDocument": {
                    "documentType": "rack-editor-project",
                    "schemaVersion": "1.0.0",
                    "layout": {"entities": []},
                },
                "bomSnapshot": {
                    "catalogVersion": "rack-catalog-lists-v1",
                    "items": [{"sku": "SKU-1", "name": "Item 1", "quantity": 1}],
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
