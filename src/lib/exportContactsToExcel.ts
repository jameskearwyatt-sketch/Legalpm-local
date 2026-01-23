import ExcelJS from "exceljs";

export interface ContactExportData {
  full_name: string;
  email: string;
  company: string | null;
  job_title: string | null;
  country: string | null;
  city: string | null;
  gender: string;
  sectors: string[];
  linkedin_url: string | null;
  relationship_owner: string | null;
  do_not_contact: boolean;
}

export async function exportContactsToExcel(contacts: ContactExportData[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Contacts Manager";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Contacts", {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  // Define columns with widths
  worksheet.columns = [
    { key: "full_name", width: 28 },
    { key: "email", width: 32 },
    { key: "company", width: 28 },
    { key: "job_title", width: 24 },
    { key: "country", width: 18 },
    { key: "city", width: 18 },
    { key: "gender", width: 12 },
    { key: "sectors", width: 36 },
    { key: "linkedin_url", width: 32 },
    { key: "relationship_owner", width: 20 },
    { key: "do_not_contact", width: 16 },
  ];

  // Add title row
  const titleRow = worksheet.getRow(1);
  worksheet.mergeCells("A1:K1");
  const titleCell = titleRow.getCell(1);
  titleCell.value = `Contacts Export — ${new Date().toLocaleDateString("en-GB", { 
    day: "numeric", 
    month: "long", 
    year: "numeric" 
  })}`;
  titleCell.font = { size: 16, bold: true, color: { argb: "FF1F2937" } };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF3F4F6" },
  };
  titleRow.height = 32;

  // Add header row
  const headers = [
    "Full Name",
    "Email",
    "Company",
    "Job Title",
    "Country",
    "City",
    "Gender",
    "Sectors",
    "LinkedIn",
    "Relationship Owner",
    "Do Not Contact",
  ];

  const headerRow = worksheet.getRow(2);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF3B82F6" }, // Blue header
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF2563EB" } },
      bottom: { style: "thin", color: { argb: "FF2563EB" } },
      left: { style: "thin", color: { argb: "FF2563EB" } },
      right: { style: "thin", color: { argb: "FF2563EB" } },
    };
  });
  headerRow.height = 28;

  // Add data rows
  contacts.forEach((contact, index) => {
    const row = worksheet.getRow(index + 3);
    
    row.getCell(1).value = contact.full_name;
    row.getCell(2).value = contact.email;
    row.getCell(3).value = contact.company || "";
    row.getCell(4).value = contact.job_title || "";
    row.getCell(5).value = contact.country || "";
    row.getCell(6).value = contact.city || "";
    row.getCell(7).value = contact.gender || "";
    row.getCell(8).value = contact.sectors.join("; ");
    row.getCell(9).value = contact.linkedin_url || "";
    row.getCell(10).value = contact.relationship_owner || "";
    row.getCell(11).value = contact.do_not_contact ? "Yes" : "No";

    // Alternate row colors for readability
    const fillColor = index % 2 === 0 ? "FFF9FAFB" : "FFFFFFFF";
    
    for (let col = 1; col <= 11; col++) {
      const cell = row.getCell(col);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fillColor },
      };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
      cell.alignment = { vertical: "middle" };
    }

    // Style the "Do Not Contact" cell with conditional formatting
    const dncCell = row.getCell(11);
    if (contact.do_not_contact) {
      dncCell.font = { bold: true, color: { argb: "FFDC2626" } };
      dncCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEE2E2" },
      };
    }

    // Make LinkedIn URLs clickable
    if (contact.linkedin_url) {
      const linkedinCell = row.getCell(9);
      linkedinCell.value = {
        text: contact.linkedin_url,
        hyperlink: contact.linkedin_url,
      };
      linkedinCell.font = { color: { argb: "FF2563EB" }, underline: true };
    }

    row.height = 22;
  });

  // Add summary row at the bottom
  const summaryRowIndex = contacts.length + 4;
  const summaryRow = worksheet.getRow(summaryRowIndex);
  worksheet.mergeCells(`A${summaryRowIndex}:K${summaryRowIndex}`);
  const summaryCell = summaryRow.getCell(1);
  summaryCell.value = `Total: ${contacts.length} contact${contacts.length !== 1 ? "s" : ""}`;
  summaryCell.font = { bold: true, italic: true, color: { argb: "FF6B7280" } };
  summaryCell.alignment = { horizontal: "left", vertical: "middle" };
  summaryCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF3F4F6" },
  };
  summaryRow.height = 24;

  // Generate and download the file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `contacts-export-${new Date().toISOString().split("T")[0]}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
