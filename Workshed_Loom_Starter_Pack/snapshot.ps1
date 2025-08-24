param(
  [string]$Host = "localhost",
  [int]$Port = 5432,
  [string]$Db = "rabspocdb",
  [string]$User = "postgres",
  [string]$OutDir = ".\db_snapshot",
  [string]$PsqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe",
  [string]$PgDumpPath = "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
  [string]$Password = ""
)
# Usage example:
#   .\snapshot.ps1 -Host localhost -Port 5432 -Db rabspocdb -User postgres -Password "yourpass" -OutDir C:\tmp\dbsnap

function Ensure-Tool([string]$Path, [string]$Name) {
  if (!(Test-Path $Path)) {
    Write-Host "$Name not found at $Path" -ForegroundColor Yellow
  } else {
    Write-Host "$Name found at $Path"
  }
}

if ($Password) { $env:PGPASSWORD = $Password }

Ensure-Tool $PsqlPath "psql.exe"
Ensure-Tool $PgDumpPath "pg_dump.exe"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $OutDir "structure") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $OutDir "info") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $OutDir "data") | Out-Null

# 1) Schema-only dump
& "$PgDumpPath" -h $Host -p $Port -U $User -d $Db -s -f (Join-Path $OutDir "structure\schema.sql")

# 2) Introspection
$introSqlPath = Join-Path $PSScriptRoot "db_introspection.sql"
& "$PsqlPath" -h $Host -p $Port -U $User -d $Db -v "ON_ERROR_STOP=1" -f $introSqlPath | Out-File (Join-Path $OutDir "info\introspection.txt") -Encoding utf8

# 3) Table list
$tableList = & "$PsqlPath" -h $Host -p $Port -U $User -d $Db -At -c "SELECT table_schema||'.'||table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1;"
$tables = $tableList -split "`n" | Where-Object { $_ -and $_.Trim() -ne "" }
$tables | Out-File (Join-Path $OutDir "info\tables.txt") -Encoding utf8

# 4) Per-table counts and samples (top 5)
foreach ($t in $tables) {
  $safe = $t -replace '[^\w]+','_'
  & "$PsqlPath" -h $Host -p $Port -U $User -d $Db -At -F ',' -c "SELECT '$t' AS table_name, COUNT(*) AS row_count FROM $t;" | Out-File (Join-Path $OutDir "info\$safe.count.csv") -Encoding utf8
  & "$PsqlPath" -h $Host -p $Port -U $User -d $Db -c "\copy (SELECT * FROM $t LIMIT 5) TO STDOUT WITH CSV HEADER" | Out-File (Join-Path $OutDir "data\$safe.sample.csv") -Encoding utf8
}

Write-Host "Snapshot complete → $OutDir" -ForegroundColor Green
