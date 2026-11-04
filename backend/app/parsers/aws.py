import io
import pandas as pd
from app.parsers.common import normalize_billing_frame

def parse_aws_billing(content: bytes):
    return normalize_billing_frame(pd.read_csv(io.BytesIO(content)), "aws")
