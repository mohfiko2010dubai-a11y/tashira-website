import { createPool, type Pool } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MysqlOperationsSqlClient } from "./mysql-query-client";
import { MysqlOperationsCaseReadProvider } from "./mysql-case-read-provider";

const databaseUrl = process.env.OPS_READ_DATABASE_URL;
const integration = databaseUrl ? describe.sequential : describe.skip;

function insertedId(result: object): number {
  const id = Reflect.get(result, "insertId");
  if (typeof id !== "number" || id <= 0) throw new Error("Synthetic insert failed");
  return id;
}

integration("MySQL Operations case read provider", () => {
  let pool: Pool;
  let applicationId = 0;
  let supplierId = 0;
  const reference = `TSH-READ-${process.pid}-${Date.now()}`;

  beforeAll(async () => {
    pool = createPool({ uri: databaseUrl ?? "", connectionLimit: 2 });
    const [supplier] = await pool.execute("INSERT INTO suppliers (name,is_active) VALUES ('Synthetic Read Supplier','active')");
    supplierId = insertedId(supplier);
    const [application] = await pool.execute(
      `INSERT INTO applications
       (reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,
        exchange_rate,total_amount_aed,total_amount_usd,supplier_id,status,payment_status,data_classification)
       VALUES (?,'family','gcc-resident','30days-single','regular','synthetic@example.invalid','000',3.67,1211.10,330.00,?,'submitted','pending','TEST')`,
      [reference, supplierId],
    );
    applicationId = insertedId(application);
    const [a] = await pool.execute("INSERT INTO applicants (application_id,applicant_index,full_name,nationality,gcc_residence_country) VALUES (?,0,'Applicant A','Egyptian','UAE')", [applicationId]);
    const [b] = await pool.execute("INSERT INTO applicants (application_id,applicant_index,full_name,nationality,gcc_residence_country) VALUES (?,1,'Applicant B','Indian','KSA')", [applicationId]);
    await pool.execute(
      "INSERT INTO documents (application_id,applicant_id,document_type,original_file_name,stored_file_name,mime_type,file_size,storage_provider,storage_bucket,storage_path,upload_status) VALUES (?,?,'passport','a.pdf','a.pdf','application/pdf',10,'filesystem','private','synthetic/a.pdf','uploaded'),(?,?,'photo','b.jpg','b.jpg','image/jpeg',10,'filesystem','private','synthetic/b.jpg','uploaded')",
      [applicationId, insertedId(a), applicationId, insertedId(b)],
    );
  });

  afterAll(async () => {
    await pool.execute("DELETE FROM documents WHERE application_id=?", [applicationId]);
    await pool.execute("DELETE FROM applicants WHERE application_id=?", [applicationId]);
    await pool.execute("DELETE FROM applications WHERE id=?", [applicationId]);
    await pool.execute("DELETE FROM suppliers WHERE id=?", [supplierId]);
    await pool.end();
  });

  it("loads a legacy family with applicant-scoped documents and no financial fields", async () => {
    const result = await new MysqlOperationsCaseReadProvider(new MysqlOperationsSqlClient(pool)).load(reference);
    expect(result?.source.summary).toMatchObject({ applicationId, reference, legacy: true });
    expect(result?.source.applicants).toHaveLength(2);
    expect(result?.source.documents.map((item) => item.applicantId)).toEqual(result?.source.applicants.map((item) => item.applicantId));
    expect(result?.source.supplier).toEqual({ id: supplierId, name: "Synthetic Read Supplier", slaHours: null, reliabilityScore: null });
  });
});
