from io import BytesIO
from datetime import datetime, timezone
from fastapi import APIRouter, Header
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from xml.sax.saxutils import escape
from app.services.supabase_rest import get_supabase_client_from_authorization
from app.services.import_service import load_dashboard_data

router=APIRouter(tags=["reports"])

@router.get("/reports/summary.pdf")
async def summary_report(authorization:str|None=Header(default=None)):
    db,user=await get_supabase_client_from_authorization(authorization)
    data=await load_dashboard_data(db)
    buffer=BytesIO()
    doc=SimpleDocTemplate(buffer,pagesize=A4,rightMargin=18*mm,leftMargin=18*mm,topMargin=17*mm,bottomMargin=17*mm)
    styles=getSampleStyleSheet()
    story=[
        Paragraph("Multi-Cloud Cost Optimizer",styles["Title"]),
        Paragraph("Cloud spend and optimization summary",styles["Heading2"]),
        Paragraph("Generated: "+datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),styles["Normal"]),
        Paragraph("Account: "+escape(str(user.get("email") or "Authenticated user")),styles["Normal"]),
        Spacer(1,8*mm),
        Paragraph("Billing overview",styles["Heading2"]),
    ]
    totals=data["summary"].get("total_cost_by_currency",{})
    if totals:
        summary_rows=[["Currency","Imported spend"]]
        summary_rows.extend([[currency,f"{amount:,.2f}"] for currency,amount in totals.items()])
        table=Table(summary_rows,hAlign="LEFT",colWidths=[45*mm,70*mm])
        table.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,0),colors.HexColor("#0F766E")),
            ("TEXTCOLOR",(0,0),(-1,0),colors.white),
            ("GRID",(0,0),(-1,-1),0.3,colors.HexColor("#CBD5E1")),
            ("PADDING",(0,0),(-1,-1),7),
        ]))
        story.append(table)
    else:
        story.append(Paragraph("No billing records have been imported.",styles["Normal"]))
    story += [Spacer(1,5*mm),Paragraph("Spend by service",styles["Heading2"])]
    services=data["summary"].get("service_costs",[])[:15]
    if services:
        rows=[["Service","Currency","Cost"]]+[[escape(str(x["service_name"])),escape(str(x["currency"])),f'{x["cost"]:,.2f}'] for x in services]
        table=Table(rows,hAlign="LEFT",colWidths=[85*mm,30*mm,40*mm],repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,0),colors.HexColor("#1E293B")),
            ("TEXTCOLOR",(0,0),(-1,0),colors.white),
            ("GRID",(0,0),(-1,-1),0.3,colors.HexColor("#CBD5E1")),
            ("PADDING",(0,0),(-1,-1),6),
        ]))
        story.append(table)
    else:
        story.append(Paragraph("No service-level billing data available.",styles["Normal"]))
    story += [Spacer(1,5*mm),Paragraph("Optimization recommendations",styles["Heading2"])]
    recs=data.get("recommendations",[])[:20]
    if recs:
        for rec in recs:
            story.append(Paragraph(
                f'<b>{escape(str(rec.get("title","Recommendation")))}</b> — {escape(str(rec.get("provider","")).upper())} / {escape(str(rec.get("resource_id") or "resource"))}',
                styles["Normal"]))
            story.append(Paragraph(escape(str(rec.get("explanation",""))),styles["BodyText"]))
            story.append(Spacer(1,2*mm))
    else:
        story.append(Paragraph("No recommendations have been generated from uploaded metrics.",styles["Normal"]))
    story += [Spacer(1,5*mm),Paragraph("Cost anomalies",styles["Heading2"])]
    anomalies=data.get("cost_anomalies",[])
    if anomalies:
        for item in anomalies:
            story.append(Paragraph(
                f'{item["provider"].upper()} {item["period"]}: {item["increase_pct"]:.1f}% above the historical baseline ({item["currency"]}).',
                styles["Normal"]))
    else:
        story.append(Paragraph("No anomalies met the configured history and threshold requirements.",styles["Normal"]))
    story += [Spacer(1,5*mm),Paragraph("Important limitations",styles["Heading2"]),
        Paragraph("Billing totals reflect uploaded source records. CPU and memory recommendations require a separate utilization metrics export. Forecasts and savings are estimates, not guaranteed outcomes. Cross-cloud cost comparisons are only valid when configuration, region, currency and pricing dates are comparable. This report does not execute changes in cloud accounts.",styles["BodyText"])]
    doc.build(story)
    buffer.seek(0)
    return StreamingResponse(buffer,media_type="application/pdf",
        headers={"Content-Disposition":'attachment; filename="multi-cloud-cost-optimizer-report.pdf"'})
