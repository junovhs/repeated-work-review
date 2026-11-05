"""Order report: builds orders, validates and enriches them, writes a summary.

Run: python pipeline.py
"""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).parent
REGIONS = ["north", "south", "east", "west"]


def make_data(n_customers=400, n_orders=3000):
    customers = [
        {"id": i, "name": f"cust{i}", "region": REGIONS[i % 4]}
        for i in range(n_customers)
    ]
    orders = [
        f"{j},{(j * 7919) % n_customers},{(j * 31) % 500 / 10:.2f},sku{j % 50}"
        for j in range(n_orders)
    ]
    return customers, orders


def load_config():
    return json.loads((HERE / "config.json").read_text())


def parse_order(line):
    oid, cid, amount, sku = line.split(",")
    return {"id": int(oid), "customer": int(cid), "amount": float(amount), "sku": sku}


def validate(lines):
    ok = []
    for line in lines:
        order = parse_order(line)
        if order["amount"] >= 0:
            ok.append(line)
    return ok


def enrich(lines, customers):
    out = []
    for line in lines:
        cfg = load_config()
        order = parse_order(line)
        cust = next(c for c in customers if c["id"] == order["customer"])
        blocked = set(cfg["blocked_skus"])
        if order["sku"] in blocked:
            continue
        order["region"] = cust["region"]
        order["amount"] *= cfg["tax_rate"]
        out.append(order)
    return out


def summarize(lines, enriched):
    totals = {}
    for order in enriched:
        totals[order["region"]] = totals.get(order["region"], 0) + order["amount"]
    count = len([parse_order(line) for line in lines])
    return totals, count


def fingerprint(totals):
    return hashlib.sha256(json.dumps(totals, sort_keys=True).encode()).hexdigest()


def write_report(totals, count, path):
    body = json.dumps(
        {"totals": {k: round(v, 2) for k, v in sorted(totals.items())}, "orders": count},
        indent=2,
    )
    path.write_text(body)


def fmt_money(x):
    return f"{x:,.2f}"


def main():
    customers, lines = make_data()
    good = validate(lines)
    enriched = enrich(good, customers)
    totals, count = summarize(good, enriched)
    out = HERE / "report.json"
    write_report(totals, count, out)
    for region in sorted(totals):
        write_report(totals, count, out)
        print(region, fmt_money(totals[region]))
    print("fingerprint", fingerprint(totals))


if __name__ == "__main__":
    main()
