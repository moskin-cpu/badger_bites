import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("fetch_menus", Path(__file__).parents[1] / "scripts/fetch_menus.py")
menus = importlib.util.module_from_spec(spec)
spec.loader.exec_module(menus)


class RefreshTests(unittest.TestCase):
    def test_empty_or_failed_refresh_never_replaces_snapshot(self):
        school = {"id": 1, "name": "Test", "slug": "test", "active_menu_types": menus.menu_types_for_school(1)}
        for fail in (False, True):
            with self.subTest(fail=fail), tempfile.TemporaryDirectory() as directory:
                output = Path(directory) / "menus.json"
                output.write_text("previous snapshot")

                def get_json(url):
                    if url.endswith("/schools/"):
                        return [school]
                    if fail:
                        raise OSError("upstream unavailable")
                    return {"days": []}

                with patch.object(menus, "OUTPUT", output), patch.object(menus, "FALLBACK_MARKETS", ()), patch.object(menus, "get_json", get_json):
                    with self.assertRaises(RuntimeError):
                        menus.main()
                self.assertEqual(output.read_text(), "previous snapshot")
