from collections import defaultdict
from statistics import mean
from datetime import date

def aggregate_monthly_by_provider(billing_rows):
    totals=defaultdict(float)
    for row in billing_rows:
        month=str(row["usage_start"])[:7]
        totals[(row["provider"],row["currency"],month)]+=float(row["cost"])
    return [
        {"provider":key[0],"currency":key[1],"month":key[2],"cost":round(value,2)}
        for key,value in sorted(totals.items())
    ]

def forecast_monthly_costs(monthly_rows, periods_ahead=3, minimum_history=3):
    """Transparent least-squares trend forecast, grouped by provider and currency."""
    grouped=defaultdict(list)
    for row in monthly_rows:
        grouped[(row["provider"],row["currency"])].append(row)
    forecasts=[]
    for (provider,currency),rows in grouped.items():
        rows.sort(key=lambda r:r["month"])
        if len(rows)<minimum_history:
            continue
        values=[float(row["cost"]) for row in rows]
        n=len(values)
        x_mean=(n-1)/2
        y_mean=mean(values)
        denominator=sum((i-x_mean)**2 for i in range(n))
        slope=(sum((i-x_mean)*(values[i]-y_mean) for i in range(n))/denominator) if denominator else 0.0
        intercept=y_mean-slope*x_mean
        last_year,last_month=map(int,rows[-1]["month"].split("-"))
        for offset in range(1,periods_ahead+1):
            month_index=last_month+offset
            year=last_year+(month_index-1)//12
            month=((month_index-1)%12)+1
            estimate=max(0.0,intercept+slope*(n-1+offset))
            forecasts.append({
                "provider":provider,"currency":currency,
                "month":f"{year:04d}-{month:02d}",
                "forecast_cost":round(estimate,2),
                "method":"linear trend",
                "history_months":n,
                "limitations":"Trend estimate from uploaded billing history; not a guarantee of future charges."
            })
    return forecasts
