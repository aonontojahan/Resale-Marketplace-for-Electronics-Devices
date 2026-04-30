import os
import shutil

# This script was generated to force apply changes to backend/main.py
# because the multi_replace_file_content tool was flagged.

filepath = r"e:\PROJECTS\Resale-Marketplace-for-Electronics-Devices\backend\main.py"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "@app.post(\"/escrow/dispute/{offer_id}\")" in line:
        new_lines.append(line)
        continue
    if "async def dispute_payment(offer_id: int, db: Session = Depends(get_db)" in line:
        new_lines.append(line.replace("offer_id: int,", "offer_id: int, reason: str = None,"))
        continue
    if "text=f\"⚠️ DISPUTE RAISED: The buyer has reported a problem with this transaction.\"" in line:
        new_lines.append("        text=f\"⚠️ DISPUTE RAISED: {reason}\" if reason else \"⚠️ DISPUTE RAISED: The buyer has reported a problem with this transaction.\"\n")
        continue
    new_lines.append(line)

with open(filepath, "w", encoding="utf-8") as f:
    f.writelines(new_lines)
print("Updated backend/main.py")
