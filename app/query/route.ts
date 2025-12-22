import postgres from 'postgres';

// 延迟初始化数据库连接，避免在构建时立即连接
let sql: ReturnType<typeof postgres> | null = null;

function getDb() {
  if (!sql) {
    if (!process.env.POSTGRES_URL) {
      throw new Error('POSTGRES_URL environment variable is not set');
    }
    sql = postgres(process.env.POSTGRES_URL, { ssl: 'require' });
  }
  return sql;
}

async function listInvoices() {
	const data = await getDb()`
    SELECT invoices.amount, customers.name
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE invoices.amount = 666;
  `;

	return data;
}

export async function GET() {
  // return Response.json({
  //   message:
  //     'Uncomment this file and remove this line. You can delete this file when you are finished.',
  // });
  try {
  	return Response.json(await listInvoices());
  } catch (error) {
  	return Response.json({ error }, { status: 500 });
  }
}
