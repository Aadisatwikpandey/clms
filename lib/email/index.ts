import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  });
}

export function overdueReminderHtml(params: {
  memberName: string;
  items: { title: string; dueDate: string; fine: string }[];
  totalFine: string;
}) {
  const rows = params.items
    .map((i) => `<tr><td>${i.title}</td><td>${i.dueDate}</td><td>₹${i.fine}</td></tr>`)
    .join("");
  return `
    <h2>Library Overdue Notice – AMC Engineering College</h2>
    <p>Dear ${params.memberName},</p>
    <p>The following items are overdue. Please return them at the earliest.</p>
    <table border="1" cellpadding="6" style="border-collapse:collapse">
      <thead><tr><th>Title</th><th>Due Date</th><th>Fine</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p><strong>Total Outstanding Fine: ₹${params.totalFine}</strong></p>
    <p>Library Team, AMC Engineering College</p>
  `;
}

export function reservationReadyHtml(params: {
  memberName: string;
  title: string;
  pickupBy: string;
}) {
  return `
    <h2>Book Ready for Pickup – AMC Engineering College Library</h2>
    <p>Dear ${params.memberName},</p>
    <p>Your reserved book <strong>"${params.title}"</strong> is available for pickup.</p>
    <p>Please collect it before <strong>${params.pickupBy}</strong>.</p>
    <p>Library Team, AMC Engineering College</p>
  `;
}

export function fineReceiptHtml(params: {
  memberName: string;
  receiptNo: string;
  amount: string;
  date: string;
}) {
  return `
    <h2>Fine Payment Receipt – AMC Engineering College Library</h2>
    <p>Dear ${params.memberName},</p>
    <p>Receipt No: <strong>${params.receiptNo}</strong></p>
    <p>Amount Paid: <strong>₹${params.amount}</strong> on ${params.date}</p>
    <p>Thank you for clearing your dues.</p>
    <p>Library Team, AMC Engineering College</p>
  `;
}
