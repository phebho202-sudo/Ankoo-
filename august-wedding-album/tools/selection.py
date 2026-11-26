"""Curated sequence for the August 2026 wedding album (21 Aug 2026).

Each chapter lists original Drive filenames in album order.
Sections with no source photographs are recorded in MISSING, not invented.
"""

COVER = "DSCF0230.jpg"

CHAPTERS = [
    ("I", "The Couple", "Portraits of the two of them, chosen from across the day.",
     ["DSCF9966.jpg", "DSCF9958.jpg", "6.jpg"]),
    ("II", "The Bride", "Bridal portraits.",
     ["DSCF0300.jpg", "DSCF0311.jpg", "DSCF0305.jpg"]),
    ("III", "The Groom", "Groom portraits and his groomsmen.",
     ["DSCF9939.jpg", "DSCF9941.jpg", "_AMP3315.jpg", "_AMP3325.jpg", "_AMP3348.jpg"]),
    ("IV", "In Tradition", "The couple in traditional attire.",
     ["5.jpg", "2.jpg", "1.jpg", "4.jpg"]),
    ("V", "The White Wedding", "Arrival, the aisle and the vows.",
     ["_AMP3116.jpg", "DSCF0001.jpg", "DSCF0061.jpg", "_AMP3129.jpg", "DSCF0070.jpg",
      "DSCF0073.jpg", "DSCF0087.jpg", "_AMP3138.jpg", "DSCF0118.jpg"]),
    ("VI", "Just the Two of Us", "Romantic portraits, including a second look.",
     ["_AMP3296.jpg", "DSCF0253.jpg", "DSCF9080.jpg", "DSCF9102.jpg", "DSCF9084.jpg", "DSCF9109.jpg"]),
    ("VII", "Family & Friends", "The people who stood with them.",
     ["DSCF0182.jpg", "DSCF0177.jpg", "DSCF0187.jpg", "DSCF0192.jpg", "DSCF0204.jpg"]),
    ("VIII", "The Celebration", "Reception, guests and the dance floor.",
     ["DSCF0500.jpg", "DSCF0509.jpg", "DSCF0374.jpg", "DSCF0353.jpg", "DSCF0347.jpg"]),
    ("IX", "In Between", "Small, unposed moments.",
     ["DSCF9095.jpg", "DSCF0173.jpg", "_AMP3126.jpg"]),
]

CLOSING = "DSCF0276.jpg"

MISSING = [
    "Bride's preparation (getting-ready) — no photographs found in any accessible source.",
    "Groom's preparation (getting-ready) — no photographs found in any accessible source.",
    "Traditional ceremony itself — only traditional-attire portraits were found, no ceremony coverage.",
]


def ordered():
    seq = [COVER]
    for *_, files in CHAPTERS:
        seq += files
    seq.append(CLOSING)
    return seq
