"""Import Hybrid / ruben_elia's visible Melee Stats tab, fetched October 7, 2026.

Source: https://docs.google.com/spreadsheets/d/1vVVsN22O3hGB2Oyowow4C2H8TQPzEyHRlbp61lNtJH8/edit#gid=1060529892
The snapshot excludes the hidden, provisional misc tab. Family and edition are
catalog classifications, not timing data. Run from any directory with Python 3.
"""
import csv
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FAMILIES = {
    "Awesomeaxe": ["Greataxe", "Unique"],
    "Axe": ["Axe", "Base"],
    "Battle Hammer": ["Battle Hammer", "Base"],
    "Battlestaff": ["Battlestaff", "Base"],
    "Cacaphonous Cleaver": ["Meat Cleaver", "Unique"],
    "Carapace Mace": ["Mace", "Unique"],
    "Claymore": ["Claymore", "Base"],
    "Clobberer": ["Clobberer", "Base"],
    "Cookiecutter": ["Cookiecutter", "Base"],
    "Diamond Shovel": ["Shovel", "Unique"],
    "Double Daggers": ["Double Daggers", "Base"],
    "Double Sickles": ["Double Sickles", "Base"],
    "Elemental Staff": ["Battlestaff", "Unique"],
    "Emerald Hammer": ["Battle Hammer", "Unique"],
    "Frostbiter": ["Longsword", "Unique"],
    "Gauntlets": ["Gauntlets", "Base"],
    "Glaive": ["Glaive", "Base"],
    "Golden Glaive": ["Glaive", "Unique"],
    "Greataxe": ["Greataxe", "Base"],
    "Greatsword": ["Greatsword", "Base"],
    "Heartbreaker": ["War Hammer", "Unique"],
    "Hunter's Hatchet": ["Axe", "Unique"],
    "Longsword": ["Longsword", "Base"],
    "Lullaby Blade": ["Cookiecutter", "Unique"],
    "Lunar Sickle": ["Tidal Sickle", "Unique"],
    "Mace": ["Mace", "Base"],
    "Meat Cleaver": ["Meat Cleaver", "Base"],
    "Mob Mallet": ["Mob Mallet", "Base"],
    "Monster Masher": ["Mob Mallet", "Unique"],
    "Pickaxe": ["Pickaxe", "Base"],
    "Pike": ["Pike", "Base"],
    "Pride of the Plains": ["Riftslasher", "Unique"],
    "Prime Enchanter's Gauntlets": ["Gauntlets", "Unique"],
    "Rapier": ["Rapier", "Base"],
    "Rascal's Razor": ["Sabre", "Unique"],
    "Redstone Wrecker": ["Clobberer", "Unique"],
    "Riftslasher": ["Riftslasher", "Base"],
    "Sabre": ["Sabre", "Base"],
    "Sculker Claws": ["Wolf Claws", "Unique"],
    "Sculker's Bane": ["Twilight Dagger", "Unique"],
    "Scythe": ["Scythe", "Base"],
    "Short Spear": ["Short Spear", "Base"],
    "Shovel": ["Shovel", "Base"],
    "Sift Sickles": ["Double Sickles", "Unique"],
    "Slaymore": ["Claymore", "Unique"],
    "Soul Reaper": ["Scythe", "Unique"],
    "Spectral Spear": ["Short Spear", "Unique"],
    "Stormcaller": ["Pike", "Unique"],
    "Sword": ["Sword", "Base"],
    "The Burning Blade": ["Sword", "Unique"],
    "The Darkshard": ["Greatsword", "Unique"],
    "The Prospector's Pick": ["Pickaxe", "Unique"],
    "The Thousand Cuts": ["Rapier", "Unique"],
    "Tidal Sickle": ["Tidal Sickle", "Base"],
    "Twilight Dagger": ["Twilight Dagger", "Base"],
    "Venomous Fangs": ["Double Daggers", "Unique"],
    "War Hammer": ["War Hammer", "Base"],
    "Wolf Claws": ["Wolf Claws", "Base"],
}


def load_weapons():
    with (ROOT / "docs/sources/melee-chart-snapshot.csv").open(newline="") as source:
        reader = csv.DictReader(source)
        reader.fieldnames = [" ".join(header.split()) for header in reader.fieldnames]
        rows = list(reader)
    assert len(rows) == len(FAMILIES) == 58
    assert {row["Melee Weapon"] for row in rows} == set(FAMILIES)
    weapons = []
    for row in rows:
        name = row["Melee Weapon"]
        family, edition = FAMILIES[name]
        stages = []
        start = float(row["Delay [s]"])
        for variant in range(1, int(row["Total Hit Variants"]) + 1):
            suffix = f"V{variant}"
            duration = float(row[f"Duration {suffix} [s]"])
            hit_times = [float(value.strip()) for value in row[f"Hits {suffix} [s]"].split(",")]
            post_delay = float(row[f"Post-Delay {suffix} [s]"])
            damage_per_hit = float(row[f"Damage per Hit {suffix}"])
            damage = float(row[f"Total Damage {suffix}"])
            assert len(hit_times) == int(row[f"Total Hits {suffix}"])
            assert math.isclose(damage_per_hit * len(hit_times), damage)
            assert all(0 <= hit <= duration for hit in hit_times)
            stages.append({
                "stage": suffix, "damage": damage, "damagePerHit": damage_per_hit,
                "start": start, "duration": duration, "hits": hit_times,
                "end": start + duration, "postDelay": post_delay,
            })
            start += duration + post_delay
        weapon = {
            "name": name, "family": family, "edition": edition,
            "breakdown": row["Damage Breakdown"], "damage": float(row["Sum Combo Damage"]),
            "comboDuration": float(row["Actual Combo Duration"]),
            "dps": float(row["Base Attack DPS"]), "delay": float(row["Delay [s]"]),
            "jumpDamage": float(row["Jump Attack Damage"]),
            "jumpInterval": float(row["Jump Attack Interval"]),
            "jumpDps": float(row["Jump Attack DPS"]), "stages": stages,
        }
        assert math.isclose(sum(stage["damage"] for stage in stages), weapon["damage"])
        assert abs(start - weapon["comboDuration"]) <= 0.02
        assert weapon["jumpInterval"] > 0
        assert math.isclose(weapon["jumpDps"], weapon["jumpDamage"] / weapon["jumpInterval"])
        weapons.append(weapon)
    return weapons


if __name__ == "__main__":
    weapons = load_weapons()
    (ROOT / "src/features/resources/melee-weapons.json").write_text(
        json.dumps(weapons, indent=2, ensure_ascii=False) + "\n"
    )
