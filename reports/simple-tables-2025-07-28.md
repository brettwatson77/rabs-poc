# Simple Tables Check Report

**Generated:** 2025-07-28T16:45:06.497Z

## vehicles

- Database columns: 10
- Expected columns: 10

### Missing Columns

- `vehicle_type`
- `wheelchair_access`
- `status`
- `rego_expiry`
- `insurance_expiry`

### SQL to Add Missing Columns

```sql
ALTER TABLE vehicles ADD COLUMN vehicle_type TEXT;
ALTER TABLE vehicles ADD COLUMN wheelchair_access TEXT;
ALTER TABLE vehicles ADD COLUMN status TEXT;
ALTER TABLE vehicles ADD COLUMN rego_expiry TEXT;
ALTER TABLE vehicles ADD COLUMN insurance_expiry TEXT;
```

## venues

- Database columns: 14
- Expected columns: 12

### Missing Columns

- `venue_type`
- `booking_lead_time`
- `status`
- `amenities`
- `accessibility`

### SQL to Add Missing Columns

```sql
ALTER TABLE venues ADD COLUMN venue_type TEXT;
ALTER TABLE venues ADD COLUMN booking_lead_time TEXT;
ALTER TABLE venues ADD COLUMN status TEXT;
ALTER TABLE venues ADD COLUMN amenities TEXT;
ALTER TABLE venues ADD COLUMN accessibility TEXT;
```

## participants

- Database columns: 23
- Expected columns: 14

### Missing Columns

- `plan_management_type`
- `support_needs`

### SQL to Add Missing Columns

```sql
ALTER TABLE participants ADD COLUMN plan_management_type TEXT;
ALTER TABLE participants ADD COLUMN support_needs TEXT;
```

## staff

- Database columns: 22
- Expected columns: 10

✅ No missing columns

## Summary

- **Total missing columns:** 12
- **Total potential mismatches:** 0

## Next Steps

1. Add missing columns to database tables
2. Update frontend code to use correct column names
3. Test each simple page (Vehicles, Venues, Participants, Staff) individually
4. Move on to more complex pages once simple pages are working
