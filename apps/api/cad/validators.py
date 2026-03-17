import math

from .models import HOLE_STEP_IN

ROW_CONFIGURATION_TO_COUNT = {
    "SINGLE": 1,
    "BACK_TO_BACK_2": 2,
    "BACK_TO_BACK_3": 3,
    "BACK_TO_BACK_4": 4,
}

CAPACITY_ORDER_DEFAULT = {}


def validate_cad_design(payload):
    """Validate an incoming CAD design payload against the rack business rules."""
    catalog = payload.get("catalog", {})
    design_revision = payload.get("designRevision", {})
    bom_snapshot = design_revision.get("bomSnapshot")

    frame_specs = _index_by_id(catalog.get("frameSpecs", []))
    beam_specs = _index_by_id(catalog.get("beamSpecs", []))

    rack_line_results = []
    for rack_line_index, rack_line in enumerate(design_revision.get("rackLines", [])):
        rack_line_results.append(
            _validate_rack_line(
                rack_line=rack_line,
                rack_line_index=rack_line_index,
                frame_specs=frame_specs,
                beam_specs=beam_specs,
                catalog=catalog,
                bom_snapshot=bom_snapshot,
            )
        )

    return {
        "designRevisionId": design_revision.get("id"),
        "validationState": _merge_states(result["validationState"] for result in rack_line_results) if rack_line_results else "VALID",
        "rackLines": rack_line_results,
    }


def _validate_rack_line(rack_line, rack_line_index, frame_specs, beam_specs, catalog, bom_snapshot):
    errors = []
    incompletes = []
    warnings = []

    frames = rack_line.get("frames", [])
    modules = rack_line.get("modules", [])
    row_configuration = rack_line.get("rowConfiguration", "SINGLE")
    expected_row_count = ROW_CONFIGURATION_TO_COUNT.get(row_configuration)

    if expected_row_count is None:
        errors.append(
            _issue(
                code="INVALID_ROW_CONFIGURATION",
                rule="ROW_CONFIGURATION",
                path=_line_path(rack_line_index, "rowConfiguration"),
                message=f"Unknown row configuration {row_configuration!r}.",
            )
        )
        expected_row_count = 1

    if len(frames) < 2:
        errors.append(
            _issue(
                code="FRAME_COUNT_INVALID",
                rule="SECTION_11",
                path=_line_path(rack_line_index, "frames"),
                message="A rack line must include at least two frames.",
            )
        )

    resolved_frames = {}
    row_frame_indices = {row_index: [] for row_index in range(expected_row_count)}
    for frame_index, frame in enumerate(frames):
        frame_spec = frame_specs.get(frame.get("specId"))
        if frame_spec is None:
            errors.append(
                _issue(
                    code="UNKNOWN_FRAME_SPEC",
                    rule="CATALOG",
                    path=_line_path(rack_line_index, f"frames[{frame_index}].specId"),
                    message=f"Unknown frame spec {frame.get('specId')!r}.",
                )
            )
            continue

        if expected_row_count == 1:
            row_index = 0
        else:
            row_index = frame.get("rowIndex")
            if row_index is None:
                errors.append(
                    _issue(
                        code="FRAME_ROW_INDEX_REQUIRED",
                        rule="V13",
                        path=_line_path(rack_line_index, f"frames[{frame_index}].rowIndex"),
                        message="Frames in back-to-back lines must declare rowIndex.",
                    )
                )
                continue
            if not _is_non_negative_int(row_index) or row_index >= expected_row_count:
                errors.append(
                    _issue(
                        code="FRAME_ROW_INDEX_OUT_OF_RANGE",
                        rule="V13",
                        path=_line_path(rack_line_index, f"frames[{frame_index}].rowIndex"),
                        message="Frame rowIndex must be an integer within the configured row count.",
                    )
                )
                continue

        resolved_frames[frame_index] = {
            "raw": frame,
            "spec": frame_spec,
            "rowIndex": row_index,
            "index": frame_index,
        }
        row_frame_indices[row_index].append(frame_index)

    if expected_row_count > 1:
        back_to_back_config = rack_line.get("backToBackConfig")
        if not back_to_back_config:
            errors.append(
                _issue(
                    code="BACK_TO_BACK_CONFIG_REQUIRED",
                    rule="SECTION_9_2",
                    path=_line_path(rack_line_index, "backToBackConfig"),
                    message="Back-to-back lines must include backToBackConfig.",
                )
            )
        else:
            configured_row_count = back_to_back_config.get("rowCount")
            if configured_row_count != expected_row_count:
                errors.append(
                    _issue(
                        code="ROW_COUNT_MISMATCH",
                        rule="V12",
                        path=_line_path(rack_line_index, "backToBackConfig.rowCount"),
                        message="backToBackConfig.rowCount must match rowConfiguration.",
                    )
                )

            minimum_row_spacer_in = catalog.get("minimumRowSpacerIn", 0)
            row_spacer_size_in = back_to_back_config.get("rowSpacerSizeIn")
            if not _is_number(row_spacer_size_in) or row_spacer_size_in < minimum_row_spacer_in:
                errors.append(
                    _issue(
                        code="ROW_SPACER_BELOW_MINIMUM",
                        rule="V14",
                        path=_line_path(rack_line_index, "backToBackConfig.rowSpacerSizeIn"),
                        message="Row spacer size must satisfy the catalog minimum.",
                    )
                )

    for row_index, frame_indices in row_frame_indices.items():
        if not frame_indices:
            continue
        depths = {
            resolved_frames[frame_index]["spec"]["depthIn"]
            for frame_index in frame_indices
            if frame_index in resolved_frames
        }
        if len(depths) > 1:
            errors.append(
                _issue(
                    code="FRAME_DEPTH_NOT_UNIFORM_WITHIN_ROW",
                    rule="V9",
                    path=_line_path(rack_line_index, "frames"),
                    message=f"All frames in row {row_index} must share the same depth.",
                )
            )

    modules_by_row = {row_index: [] for row_index in range(expected_row_count)}
    for module_index, module in enumerate(modules):
        bays = module.get("bays", [])
        start_frame_index = module.get("startFrameIndex")
        derived_end_frame_index = (
            start_frame_index + len(bays)
            if isinstance(start_frame_index, int)
            else None
        )

        if not bays:
            errors.append(
                _issue(
                    code="MODULE_HAS_NO_BAYS",
                    rule="SECTION_4_3",
                    path=_line_path(rack_line_index, f"modules[{module_index}].bays"),
                    message="Modules must contain at least one bay.",
                )
            )
            continue

        if not _is_non_negative_int(start_frame_index):
            errors.append(
                _issue(
                    code="MODULE_START_INDEX_INVALID",
                    rule="V7",
                    path=_line_path(rack_line_index, f"modules[{module_index}].startFrameIndex"),
                    message="Module startFrameIndex must be a non-negative integer.",
                )
            )
            continue

        if derived_end_frame_index is None or derived_end_frame_index >= len(frames):
            errors.append(
                _issue(
                    code="MODULE_FRAME_RANGE_OUT_OF_BOUNDS",
                    rule="V7",
                    path=_line_path(rack_line_index, f"modules[{module_index}]"),
                    message="Module frame range must stay within the line frame bounds.",
                )
            )
            continue

        module_frame_row_indices = {
            resolved_frames[frame_index]["rowIndex"]
            for frame_index in range(start_frame_index, derived_end_frame_index + 1)
            if frame_index in resolved_frames
        }
        if len(module_frame_row_indices) > 1:
            errors.append(
                _issue(
                    code="MODULE_SPANS_MULTIPLE_ROWS",
                    rule="SECTION_9_2_4",
                    path=_line_path(rack_line_index, f"modules[{module_index}]"),
                    message="A module cannot span frames from different back-to-back rows.",
                )
            )
            continue

        module_row_index = next(iter(module_frame_row_indices), 0)
        declared_row_index = module.get("rowIndex")
        if expected_row_count > 1 and declared_row_index is not None and declared_row_index != module_row_index:
            errors.append(
                _issue(
                    code="MODULE_ROW_INDEX_MISMATCH",
                    rule="SECTION_9_2_4",
                    path=_line_path(rack_line_index, f"modules[{module_index}].rowIndex"),
                    message="Module rowIndex must match the row of its covered frames.",
                )
            )

        modules_by_row[module_row_index].append(
            {
                "raw": module,
                "moduleIndex": module_index,
                "startFrameIndex": start_frame_index,
                "endFrameIndex": derived_end_frame_index,
                "rowIndex": module_row_index,
            }
        )

        for bay_index, bay in enumerate(bays):
            left_frame_index = start_frame_index + bay_index
            right_frame_index = left_frame_index + 1

            if left_frame_index not in resolved_frames or right_frame_index not in resolved_frames:
                errors.append(
                    _issue(
                        code="BAY_FRAME_REFERENCE_OUT_OF_BOUNDS",
                        rule="V7",
                        path=_line_path(rack_line_index, f"modules[{module_index}].bays[{bay_index}]"),
                        message="Bay frame references must be inside the frame array.",
                    )
                )
                continue

            left_frame = resolved_frames[left_frame_index]
            right_frame = resolved_frames[right_frame_index]

            _validate_bay(
                rack_line_index=rack_line_index,
                module_index=module_index,
                bay_index=bay_index,
                bay=bay,
                left_frame=left_frame,
                right_frame=right_frame,
                beam_specs=beam_specs,
                catalog=catalog,
                errors=errors,
                incompletes=incompletes,
                warnings=warnings,
            )

    for row_index, row_modules in modules_by_row.items():
        row_frame_start = _row_min_index(row_frame_indices[row_index])
        row_frame_end = _row_max_index(row_frame_indices[row_index])
        if row_frame_start is None or row_frame_end is None:
            continue

        if not row_modules:
            errors.append(
                _issue(
                    code="MODULE_CONTINUITY_BROKEN",
                    rule="V8",
                    path=_line_path(rack_line_index, "modules"),
                    message=f"Row {row_index} is missing module coverage.",
                )
            )
            continue

        row_modules.sort(key=lambda item: item["startFrameIndex"])
        expected_start = row_frame_start
        for row_module in row_modules:
            if row_module["startFrameIndex"] != expected_start:
                errors.append(
                    _issue(
                        code="MODULE_CONTINUITY_BROKEN",
                        rule="V8",
                        path=_line_path(rack_line_index, f"modules[{row_module['moduleIndex']}]"),
                        message=f"Modules in row {row_index} must cover frames contiguously without gaps or overlaps.",
                    )
                )
                break
            expected_start = row_module["endFrameIndex"]

        if expected_start != row_frame_end:
            errors.append(
                _issue(
                    code="MODULE_CONTINUITY_BROKEN",
                    rule="V8",
                    path=_line_path(rack_line_index, "modules"),
                    message=f"Modules in row {row_index} must end at the row's final frame.",
                )
            )

    _validate_bom_requirements(
        rack_line_index=rack_line_index,
        bom_snapshot=bom_snapshot,
        catalog=catalog,
        incompletes=incompletes,
    )

    validation_state = _state_for(errors=errors, incompletes=incompletes, warnings=warnings)
    return {
        "id": rack_line.get("id"),
        "validationState": validation_state,
        "errors": errors,
        "incompletes": incompletes,
        "warnings": warnings,
    }


def _validate_bay(
    rack_line_index,
    module_index,
    bay_index,
    bay,
    left_frame,
    right_frame,
    beam_specs,
    catalog,
    errors,
    incompletes,
    warnings,
):
    width_in = bay.get("widthIn")
    beam_levels = bay.get("beamLevels", [])
    path_prefix = _line_path(rack_line_index, f"modules[{module_index}].bays[{bay_index}]")

    if not _is_number(width_in) or width_in <= 0:
        errors.append(
            _issue(
                code="BAY_WIDTH_INVALID",
                rule="SECTION_2_2",
                path=f"{path_prefix}.widthIn",
                message="Bay width must be a positive number.",
            )
        )
        return

    if not any(spec.get("lengthIn") == width_in for spec in beam_specs.values()):
        errors.append(
            _issue(
                code="BAY_WIDTH_NOT_IN_CATALOG",
                rule="V16",
                path=f"{path_prefix}.widthIn",
                message="Bay width must correspond to a catalog beam SKU.",
            )
        )

    if not beam_levels:
        incompletes.append(
            _issue(
                code="BAY_MISSING_BEAM_LEVELS",
                rule="SECTION_11",
                path=f"{path_prefix}.beamLevels",
                message="Each bay needs at least one beam level before the design is complete.",
            )
        )
        return

    previous_level = None
    for level_position, level in enumerate(beam_levels):
        level_path = f"{path_prefix}.beamLevels[{level_position}]"
        level_index = level.get("levelIndex")
        hole_index = level.get("holeIndex")
        beam_spec = beam_specs.get(level.get("specId"))

        if level_index != level_position:
            errors.append(
                _issue(
                    code="LEVEL_INDEX_NOT_CONSECUTIVE",
                    rule="SECTION_2_4",
                    path=f"{level_path}.levelIndex",
                    message="Beam levels must use consecutive levelIndex values starting at 0.",
                )
            )

        hole_index_is_valid = _is_non_negative_int(hole_index)
        if not hole_index_is_valid:
            errors.append(
                _issue(
                    code="LEVEL_HOLE_INDEX_INVALID",
                    rule="V3",
                    path=f"{level_path}.holeIndex",
                    message="holeIndex must be a non-negative integer aligned to the 2-inch grid.",
                )
            )

        if beam_spec is None:
            errors.append(
                _issue(
                    code="UNKNOWN_BEAM_SPEC",
                    rule="CATALOG",
                    path=f"{level_path}.specId",
                    message=f"Unknown beam spec {level.get('specId')!r}.",
                )
            )
            continue

        if beam_spec.get("lengthIn") != width_in:
            errors.append(
                _issue(
                    code="BEAM_LENGTH_MISMATCH",
                    rule="V2",
                    path=f"{level_path}.specId",
                    message="Beam length must match the bay width exactly.",
                )
            )

        if left_frame["spec"].get("uprightSeries") not in beam_spec.get("compatibleUprightSeries", []):
            errors.append(
                _issue(
                    code="BEAM_UPRIGHT_SERIES_MISMATCH",
                    rule="V1",
                    path=f"{level_path}.specId",
                    message="Beam must be compatible with the left frame upright series.",
                )
            )

        if right_frame["spec"].get("uprightSeries") not in beam_spec.get("compatibleUprightSeries", []):
            errors.append(
                _issue(
                    code="BEAM_UPRIGHT_SERIES_MISMATCH",
                    rule="V1",
                    path=f"{level_path}.specId",
                    message="Beam must be compatible with the right frame upright series.",
                )
            )

        if beam_spec.get("connectorType") not in left_frame["spec"].get("compatibleConnectorTypes", []):
            errors.append(
                _issue(
                    code="BEAM_CONNECTOR_TYPE_MISMATCH",
                    rule="V11",
                    path=f"{level_path}.specId",
                    message="Beam connector type must match the left frame slot pattern.",
                )
            )

        if beam_spec.get("connectorType") not in right_frame["spec"].get("compatibleConnectorTypes", []):
            errors.append(
                _issue(
                    code="BEAM_CONNECTOR_TYPE_MISMATCH",
                    rule="V11",
                    path=f"{level_path}.specId",
                    message="Beam connector type must match the right frame slot pattern.",
                )
            )

        if _capacity_rank(beam_spec.get("capacityClass"), catalog) > _capacity_rank(left_frame["spec"].get("capacityClass"), catalog):
            errors.append(
                _issue(
                    code="BEAM_CAPACITY_EXCEEDS_FRAME",
                    rule="SECTION_12_2",
                    path=f"{level_path}.specId",
                    message="Beam capacity class must not exceed the left frame allowable class.",
                )
            )

        if _capacity_rank(beam_spec.get("capacityClass"), catalog) > _capacity_rank(right_frame["spec"].get("capacityClass"), catalog):
            errors.append(
                _issue(
                    code="BEAM_CAPACITY_EXCEEDS_FRAME",
                    rule="SECTION_12_2",
                    path=f"{level_path}.specId",
                    message="Beam capacity class must not exceed the right frame allowable class.",
                )
            )

        elevation_in = hole_index * HOLE_STEP_IN if hole_index_is_valid else None
        if elevation_in is not None:
            left_available_height = left_frame["spec"].get("heightIn", 0) - left_frame["spec"].get("minimumTopClearanceIn", 0)
            right_available_height = right_frame["spec"].get("heightIn", 0) - right_frame["spec"].get("minimumTopClearanceIn", 0)
            if elevation_in > left_available_height or elevation_in > right_available_height:
                errors.append(
                    _issue(
                        code="LEVEL_EXCEEDS_FRAME_HEIGHT",
                        rule="SECTION_7",
                        path=f"{level_path}.holeIndex",
                        message="Beam elevation must fit within both frame heights after top clearance.",
                    )
                )

            if level_position == 0:
                minimum_floor_clearance_in = catalog.get("minimumFloorClearanceIn", 0)
                if elevation_in < minimum_floor_clearance_in:
                    errors.append(
                        _issue(
                            code="FIRST_LEVEL_BELOW_FLOOR_CLEARANCE",
                            rule="V10",
                            path=f"{level_path}.holeIndex",
                            message="The first beam level must satisfy the minimum operational floor clearance.",
                        )
                    )

                if elevation_in < beam_spec.get("verticalEnvelopeIn", 0):
                    errors.append(
                        _issue(
                            code="FIRST_LEVEL_CONNECTOR_BELOW_GRADE",
                            rule="SECTION_8_2",
                            path=f"{level_path}.holeIndex",
                            message="The first beam connector envelope must stay above grade.",
                        )
                    )

        usage_percent = level.get("usagePercent")
        near_capacity_threshold_percent = catalog.get("nearCapacityThresholdPercent")
        if _is_number(usage_percent) and _is_number(near_capacity_threshold_percent) and usage_percent >= near_capacity_threshold_percent:
            warnings.append(
                _issue(
                    code="NEAR_CAPACITY_USAGE",
                    rule="W1",
                    path=f"{level_path}.usagePercent",
                    message="Beam or frame usage is near the configured capacity threshold.",
                )
            )

        if previous_level is not None and hole_index_is_valid:
            previous_hole_index = previous_level["holeIndex"]
            if isinstance(previous_hole_index, int):
                if hole_index <= previous_hole_index:
                    errors.append(
                        _issue(
                            code="LEVEL_ORDER_INVALID",
                            rule="V4",
                            path=f"{level_path}.holeIndex",
                            message="Beam levels must be strictly ordered from bottom to top.",
                        )
                    )

                minimum_gap_steps = _minimum_gap_steps(
                    lower_spec=previous_level["beamSpec"],
                    upper_spec=beam_spec,
                )
                actual_gap_steps = hole_index - previous_hole_index
                if actual_gap_steps < minimum_gap_steps:
                    errors.append(
                        _issue(
                            code="LEVEL_SPACING_TOO_TIGHT",
                            rule="V5",
                            path=f"{level_path}.holeIndex",
                            message="Adjacent beam levels are too close vertically for the beam geometry.",
                        )
                    )

                non_standard_gap_steps = catalog.get("nonStandardGapSteps")
                if _is_number(non_standard_gap_steps) and actual_gap_steps > non_standard_gap_steps:
                    warnings.append(
                        _issue(
                            code="NON_STANDARD_LEVEL_SPACING",
                            rule="WARNING",
                            path=f"{level_path}.holeIndex",
                            message="The gap between beam levels is unusually large.",
                        )
                    )

        previous_level = {
            "holeIndex": hole_index,
            "beamSpec": beam_spec,
        }


def _validate_bom_requirements(rack_line_index, bom_snapshot, catalog, incompletes):
    if not bom_snapshot or not bom_snapshot.get("items"):
        incompletes.append(
            _issue(
                code="BOM_SNAPSHOT_MISSING",
                rule="SECTION_10",
                path=_line_path(rack_line_index, "bomSnapshot"),
                message="A BOM snapshot must exist before the rack line can be treated as complete.",
            )
        )
        return

    present_skus = {item.get("sku") for item in bom_snapshot.get("items", [])}
    for required_sku in catalog.get("requiredDerivedAccessorySkus", []):
        if required_sku not in present_skus:
            incompletes.append(
                _issue(
                    code="MISSING_DERIVED_ACCESSORY",
                    rule="V15",
                    path=_line_path(rack_line_index, "bomSnapshot.items"),
                    message=f"Required derived accessory {required_sku!r} is missing from the BOM snapshot.",
                )
            )


def _minimum_gap_steps(lower_spec, upper_spec):
    minimum_gap_in = HOLE_STEP_IN + max(
        lower_spec.get("verticalEnvelopeIn", 0),
        upper_spec.get("verticalEnvelopeIn", 0),
    ) + lower_spec.get("profileHeightIn", 0)
    return math.ceil(minimum_gap_in / HOLE_STEP_IN)


def _capacity_rank(capacity_class, catalog):
    order = catalog.get("capacityClassOrder", CAPACITY_ORDER_DEFAULT)
    if isinstance(order, dict):
        return order.get(capacity_class, -1)
    if isinstance(order, list):
        try:
            return order.index(capacity_class)
        except ValueError:
            return -1
    return -1


def _index_by_id(items):
    return {
        item.get("id"): item
        for item in items
        if isinstance(item, dict) and item.get("id")
    }


def _line_path(rack_line_index, suffix):
    return f"designRevision.rackLines[{rack_line_index}].{suffix}"


def _issue(code, rule, path, message):
    return {
        "code": code,
        "rule": rule,
        "path": path,
        "message": message,
    }


def _state_for(errors, incompletes, warnings):
    if errors:
        return "INVALID"
    if incompletes:
        return "INCOMPLETE"
    if warnings:
        return "VALID_WITH_WARNINGS"
    return "VALID"


def _merge_states(states):
    resolved_states = list(states)
    if "INVALID" in resolved_states:
        return "INVALID"
    if "INCOMPLETE" in resolved_states:
        return "INCOMPLETE"
    if "VALID_WITH_WARNINGS" in resolved_states:
        return "VALID_WITH_WARNINGS"
    return "VALID"


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _is_non_negative_int(value):
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _row_min_index(indices):
    return min(indices) if indices else None


def _row_max_index(indices):
    return max(indices) if indices else None
