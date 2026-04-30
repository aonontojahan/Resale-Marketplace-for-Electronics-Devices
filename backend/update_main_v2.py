import os

# This script updates dispute_payment in backend/main.py to save the dispute_reason
filepath = r"e:\PROJECTS\Resale-Marketplace-for-Electronics-Devices\backend\main.py"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "offer.status = models.OfferStatus.DISPUTED" in line:
        new_lines.append(line)
        new_lines.append("    offer.dispute_reason = reason\n")
        continue
    new_lines.append(line)

with open(filepath, "w", encoding="utf-8") as f:
    f.writelines(new_lines)
print("Updated backend/main.py with offer.dispute_reason")
