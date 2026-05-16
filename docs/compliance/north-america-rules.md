# North America Compliance Rule Notes

## US Federal

- 2026 federal standard deductions and brackets are encoded from the IRS 2026 inflation adjustment
  release.
- Self-employment tax follows IRS Publication 505: net earnings are 92.35% of net profit, the 2026
  Social Security wage base is $184,500, Social Security tax is 12.4%, and Medicare tax is 2.9%.
- 2026 business mileage is encoded at $0.725 per mile.
- Form 1099-K monitoring uses the IRS threshold of gross reportable payments over $20,000 and more
  than 200 transactions.

## Launch-Region US Sales Tax

The first-client sales-tax build is scoped to New York, New Jersey, Connecticut, and San Francisco.
It includes deterministic rate and nexus checks for:

- New York City, Nassau, Suffolk, Westchester, and Yonkers using NY Publication 718 jurisdiction
  rates and reporting codes.
- New Jersey statewide rate and remote-seller threshold monitoring.
- Connecticut statewide rate, no-local-tax note, and special checks for computer/data processing
  services and meals.
- San Francisco city/county rate from CDTFA city and county rate tables.

Sales tax is state-local and changes frequently. Production collection should still snapshot an
official lookup/provider response with timestamp, address, source, and jurisdiction before checkout
collection or filing. New York ZIP-only matching is not treated as filing evidence.

### Launch-Region Nexus Logic

- NY: more than $500,000 and more than 100 sales into New York in the immediately preceding four
  sales-tax quarters.
- NJ: more than $100,000 in delivered gross revenue or 200 or more delivered transactions in the
  current or prior calendar year.
- CT: $100,000 and 200 transactions treated as the current remote-seller review trigger in this
  product; DRS registration guidance must be reviewed before filing setup.
- CA/SF: $500,000 California economic nexus threshold for tangible personal property delivered into
  California.

## Canada Roadmap

Canada GST/HST support remains in the package for later expansion, but the live NA workspace is now
focused on NY/NJ/CT/SF.

## Sources

- IRS 2026 inflation adjustments: https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill
- IRS Publication 505: https://www.irs.gov/publications/p505
- IRS 2026 standard mileage rate: https://www.irs.gov/newsroom/irs-sets-2026-business-standard-mileage-rate-at-725-cents-per-mile-up-25-cents
- IRS Form 1099-K FAQs: https://www.irs.gov/newsroom/form-1099-k-faqs
- NY Tax Publication 718 current local rates: https://www.tax.ny.gov/pubs_and_bulls/publications/sales/local_rates_current.htm
- NY sales-tax registration threshold: https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/do_i_need_to_register_for_sales_tax.htm
- NJ sales and use tax: https://www.nj.gov/treasury/businesses/salestax/index.shtml
- NJ remote seller FAQ: https://www.nj.gov/treasury/taxation/remotesellersfaq.shtml
- CT sales tax information: https://portal.ct.gov/DRS/Sales-Tax/Tax-Information
- California CDTFA sales and use tax rates: https://cdtfa.ca.gov/taxes-and-fees/rates.aspx
- California economic nexus notice: https://www.cdtfa.ca.gov/formspubs/l694.pdf
