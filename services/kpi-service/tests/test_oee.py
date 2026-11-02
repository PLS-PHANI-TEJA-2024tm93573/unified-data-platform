"""Focused unit tests for OEE formulas and telemetry edge cases."""

import unittest
from datetime import datetime, timedelta, timezone

from app.oee import calculate_oee


START = datetime(2026, 1, 1, tzinfo=timezone.utc)
CONFIG = {"ideal_rate_per_minute": 5, "shift_duration_minutes": 480, "planned_break_minutes": 30, "max_state_gap_seconds": 90}


def points(values):
    return [{"timestamp": (START + timedelta(seconds=second)).isoformat(), "value": value} for second, value in values]


class OeeCalculationTests(unittest.TestCase):
    def test_formula_uses_output_delta_and_machine_state_history(self):
        histories = {
            "machine_status": points([(second, "RUNNING" if second < 480 else "STOPPED") for second in range(0, 601, 60)]),
            "total_bottles": points([(0, 100), (600, 140)]),
            "good_bottles": points([(0, 90), (600, 126)]),
            "rejected_bottles": points([(0, 10), (600, 14)]),
        }
        result = calculate_oee("Packager", "Packager", CONFIG, histories, START, START + timedelta(seconds=600))
        self.assertAlmostEqual(result["availability_percent"], 80)
        self.assertAlmostEqual(result["performance_percent"], 100)
        self.assertAlmostEqual(result["quality_percent"], 90)
        self.assertAlmostEqual(result["oee_percent"], 72)
        self.assertEqual(result["total_output"], 40)
        self.assertEqual(result["good_output"] + result["rejected_output"], result["total_output"])

    def test_zero_output_has_no_division_by_zero(self):
        histories = {
            "machine_status": points([(second, "RUNNING") for second in range(0, 601, 60)]),
            "total_bottles": points([(0, 10), (600, 10)]),
            "good_bottles": points([(0, 10), (600, 10)]),
            "rejected_bottles": points([(0, 0), (600, 0)]),
        }
        result = calculate_oee("Packager", "Packager", CONFIG, histories, START, START + timedelta(seconds=600))
        self.assertEqual(result["availability_percent"], 100)
        self.assertEqual(result["performance_percent"], 0)
        self.assertIsNone(result["quality_percent"])
        self.assertIsNone(result["oee_percent"])

    def test_counter_reset_invalidates_window_output(self):
        histories = {
            "machine_status": points([(second, "RUNNING") for second in range(0, 601, 60)]),
            "total_bottles": points([(0, 100), (300, 2), (600, 20)]),
            "good_bottles": points([(0, 90), (300, 2), (600, 18)]),
            "rejected_bottles": points([(0, 10), (300, 0), (600, 2)]),
        }
        result = calculate_oee("Packager", "Packager", CONFIG, histories, START, START + timedelta(seconds=600))
        self.assertIsNone(result["total_output"])
        self.assertIsNone(result["quality_percent"])
        self.assertIsNone(result["oee_percent"])

    def test_missing_state_coverage_is_unknown_not_downtime(self):
        histories = {
            "machine_status": points([(0, "RUNNING"), (60, "RUNNING")]),
            "total_bottles": points([(0, 0), (600, 10)]),
            "good_bottles": points([(0, 0), (600, 10)]),
            "rejected_bottles": points([(0, 0), (600, 0)]),
        }
        result = calculate_oee("Packager", "Packager", CONFIG, histories, START, START + timedelta(seconds=600))
        self.assertIsNone(result["availability_percent"])
        self.assertIsNone(result["operating_seconds"])
        self.assertIsNone(result["oee_percent"])

    def test_non_reconciling_quality_counts_are_rejected(self):
        histories = {
            "machine_status": points([(second, "RUNNING") for second in range(0, 601, 60)]),
            "total_bottles": points([(0, 0), (600, 10)]),
            "good_bottles": points([(0, 0), (600, 8)]),
            "rejected_bottles": points([(0, 0), (600, 1)]),
        }
        result = calculate_oee("Packager", "Packager", CONFIG, histories, START, START + timedelta(seconds=600))
        self.assertIsNone(result["total_output"])
        self.assertIsNone(result["good_output"])
        self.assertIsNone(result["quality_percent"])


if __name__ == "__main__":
    unittest.main()
