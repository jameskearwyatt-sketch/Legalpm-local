import { format } from 'date-fns';
import type { DayOutput } from './timeRecordingTypes';

export function formatOutputForClipboard(processedOutput: DayOutput[]): string {
  let output = '';

  for (const day of processedOutput) {
    output += `═══════════════════════════════════════════════════════════════\n`;
    output += `DATE: ${format(day.date, 'EEEE, d MMMM yyyy')}\n`;
    output += `═══════════════════════════════════════════════════════════════\n\n`;

    if (day.entries.length === 0) {
      output += `No time recorded\n\n`;
      continue;
    }

    let lastMatterId: string | null = null;

    for (const entry of day.entries) {
      if (entry.type === 'matter') {
        const isNewMatter = entry.matterId !== lastMatterId;

        if (isNewMatter) {
          if (lastMatterId !== null) {
            output += `\n`;
          }
          output += `CLIENT: ${entry.clientName || 'N/A'}\n`;
          output += `MATTER: ${entry.matterName || 'N/A'}\n`;
          output += `MATTER NUMBER: ${entry.cmNumber || 'N/A'}\n`;
          output += `───────────────────────────────────────────────────────────────\n`;
          lastMatterId = entry.matterId || null;
        }

        if (entry.workItemName) {
          output += `  • WORK ITEM: ${entry.workItemName}\n`;
        }
        output += `    TIME: ${entry.hours} hours\n`;
        output += `    NARRATIVE:\n    ${(entry.polishedNarrative || entry.narrative).replace(/\n/g, '\n    ')}\n\n`;
      } else if (entry.type === 'ad-hoc') {
        lastMatterId = null;
        output += `AD-HOC MATTER: ${entry.adHocMatterName || 'Unnamed Matter'}\n`;
        output += `MATTER NUMBER: ${entry.adHocMatterNumber || 'N/A'}\n`;
        output += `───────────────────────────────────────────────────────────────\n`;
        output += `TIME: ${entry.hours} hours\n`;
        output += `NARRATIVE:\n${entry.polishedNarrative || entry.narrative}\n`;
        output += `───────────────────────────────────────────────────────────────\n\n`;
      } else {
        lastMatterId = null;
        const code = entry.nonChargeableCode ? ` (${entry.nonChargeableCode})` : '';
        output += `NON-CHARGEABLE: ${entry.nonChargeableName}${code}\n`;
        if (entry.otherDescription) {
          output += `Description: ${entry.otherDescription}\n`;
        }
        output += `TIME: ${entry.hours} hours\n`;
        output += `NARRATIVE:\n${entry.polishedNarrative || entry.narrative}\n`;
        output += `───────────────────────────────────────────────────────────────\n\n`;
      }
    }
  }

  return output;
}

export function formatOutputAsHtml(processedOutput: DayOutput[]): string {
  let html = `
    <html>
      <head>
        <style>
          body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
          .day-header { background-color: #1e3a5f; color: white; padding: 8px 12px; margin-top: 16px; font-weight: bold; }
          .matter-block { border: 1px solid #ddd; margin-bottom: 12px; }
          .matter-header { background-color: #f5f5f5; padding: 8px 12px; border-bottom: 1px solid #ddd; }
          .work-item-entry { padding: 8px 12px; border-bottom: 1px solid #eee; }
          .work-item-entry:last-child { border-bottom: none; }
          .label { font-weight: bold; color: #555; }
          .client-name { font-weight: bold; color: #1e3a5f; font-size: 12pt; }
          .matter-name { font-weight: 600; }
          .work-item-name { color: #059669; font-weight: 500; }
          .hours { font-weight: bold; color: #2563eb; }
          .narrative { margin-top: 4px; line-height: 1.4; padding-left: 8px; border-left: 2px solid #e5e7eb; }
          .non-chargeable { color: #ea580c; font-weight: bold; }
          .non-chargeable-block { border: 1px solid #fed7aa; margin-bottom: 12px; }
          .non-chargeable-header { background-color: #fff7ed; padding: 8px 12px; border-bottom: 1px solid #fed7aa; }
          table { border-collapse: collapse; width: 100%; }
          td { padding: 2px 8px; vertical-align: top; }
          .label-col { width: 100px; }
        </style>
      </head>
      <body>
  `;

  for (const day of processedOutput) {
    html += `<div class="day-header">${format(day.date, 'EEEE, d MMMM yyyy')}</div>`;

    if (day.entries.length === 0) {
      html += `<p><em>No time recorded</em></p>`;
      continue;
    }

    let currentMatterId: string | null = null;
    let matterBlockOpen = false;

    for (let i = 0; i < day.entries.length; i++) {
      const entry = day.entries[i];
      const nextEntry = day.entries[i + 1];

      if (entry.type === 'matter') {
        const isNewMatter = entry.matterId !== currentMatterId;
        const isLastOfMatter = !nextEntry || nextEntry.type !== 'matter' || nextEntry.matterId !== entry.matterId;

        if (isNewMatter) {
          if (matterBlockOpen) {
            html += `</div>`;
          }

          html += `<div class="matter-block">`;
          html += `<div class="matter-header">`;
          html += `<table>`;
          html += `<tr><td class="label-col"><span class="label">Client:</span></td><td><span class="client-name">${entry.clientName || 'N/A'}</span></td></tr>`;
          html += `<tr><td class="label-col"><span class="label">Matter:</span></td><td><span class="matter-name">${entry.matterName || 'N/A'}</span></td></tr>`;
          html += `<tr><td class="label-col"><span class="label">Matter No:</span></td><td>${entry.cmNumber || 'N/A'}</td></tr>`;
          html += `</table>`;
          html += `</div>`;

          currentMatterId = entry.matterId || null;
          matterBlockOpen = true;
        }

        html += `<div class="work-item-entry">`;
        if (entry.workItemName) {
          html += `<div><span class="label">Work Item:</span> <span class="work-item-name">${entry.workItemName}</span></div>`;
        }
        html += `<div><span class="label">Time:</span> <span class="hours">${entry.hours} hours</span></div>`;
        html += `<div class="narrative">${(entry.polishedNarrative || entry.narrative).replace(/\n/g, '<br>')}</div>`;
        html += `</div>`;

        if (isLastOfMatter && matterBlockOpen) {
          html += `</div>`;
          matterBlockOpen = false;
          currentMatterId = null;
        }
      } else if (entry.type === 'ad-hoc') {
        if (matterBlockOpen) {
          html += `</div>`;
          matterBlockOpen = false;
          currentMatterId = null;
        }

        html += `<div class="matter-block" style="border-color: #a855f7;">`;
        html += `<div class="matter-header" style="background-color: #faf5ff;">`;
        html += `<table>`;
        html += `<tr><td class="label-col"><span class="label">Matter:</span></td><td><span class="matter-name" style="color: #9333ea;">${entry.adHocMatterName || 'Unnamed Matter'}</span> <em style="color: #a855f7;">(Ad-Hoc)</em></td></tr>`;
        html += `<tr><td class="label-col"><span class="label">Matter No:</span></td><td>${entry.adHocMatterNumber || 'N/A'}</td></tr>`;
        html += `<tr><td class="label-col"><span class="label">Time:</span></td><td><span class="hours">${entry.hours} hours</span></td></tr>`;
        html += `</table>`;
        html += `</div>`;
        html += `<div class="work-item-entry">`;
        html += `<div class="narrative">${(entry.polishedNarrative || entry.narrative).replace(/\n/g, '<br>')}</div>`;
        html += `</div>`;
        html += `</div>`;
      } else {
        if (matterBlockOpen) {
          html += `</div>`;
          matterBlockOpen = false;
          currentMatterId = null;
        }

        const code = entry.nonChargeableCode ? ` (${entry.nonChargeableCode})` : '';
        html += `<div class="non-chargeable-block">`;
        html += `<div class="non-chargeable-header">`;
        html += `<table>`;
        html += `<tr><td class="label-col"><span class="label">Code:</span></td><td><span class="non-chargeable">${entry.nonChargeableName}${code}</span></td></tr>`;
        if (entry.otherDescription) {
          html += `<tr><td class="label-col"><span class="label">Description:</span></td><td>${entry.otherDescription}</td></tr>`;
        }
        html += `<tr><td class="label-col"><span class="label">Time:</span></td><td><span class="hours">${entry.hours} hours</span></td></tr>`;
        html += `</table>`;
        html += `</div>`;
        html += `<div class="work-item-entry">`;
        html += `<div class="narrative">${(entry.polishedNarrative || entry.narrative).replace(/\n/g, '<br>')}</div>`;
        html += `</div>`;
        html += `</div>`;
      }
    }

    if (matterBlockOpen) {
      html += `</div>`;
    }
  }

  html += `</body></html>`;
  return html;
}

export function formatOutputForEmail(processedOutput: DayOutput[]): string {
  const totalHours = processedOutput.reduce(
    (sum, day) => sum + day.entries.reduce((s, e) => s + e.hours, 0),
    0
  );
  const totalEntries = processedOutput.reduce((sum, day) => sum + day.entries.length, 0);

  let output = `📋 TIME RECORDING SUMMARY\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `⏱️ Total Hours: ${totalHours.toFixed(2)}\n`;
  output += `📊 Total Entries: ${totalEntries}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  for (const day of processedOutput) {
    const dayHours = day.entries.reduce((s, e) => s + e.hours, 0);
    output += `📅 ${format(day.date, 'EEEE, d MMMM yyyy')}\n`;
    output += `─────────────────────────────────────────────\n`;
    output += `   ⏱️ ${dayHours.toFixed(2)} hours • ${day.entries.length} entries\n\n`;

    if (day.entries.length === 0) {
      output += `   No time recorded\n\n`;
      continue;
    }

    let lastMatterId: string | null = null;

    for (const entry of day.entries) {
      if (entry.type === 'matter') {
        const isNewMatter = entry.matterId !== lastMatterId;

        if (isNewMatter) {
          if (lastMatterId !== null) {
            output += `\n`;
          }
          output += `   💼 CLIENT: ${entry.clientName || 'N/A'}\n`;
          output += `   📁 MATTER: ${entry.matterName || 'N/A'}\n`;
          output += `   🔢 NUMBER: ${entry.cmNumber || 'N/A'}\n`;
          lastMatterId = entry.matterId || null;
        }

        if (entry.workItemName) {
          output += `      • ${entry.workItemName}\n`;
        }
        output += `        ⏱️ ${entry.hours} hrs\n`;
        output += `        📝 ${(entry.polishedNarrative || entry.narrative).replace(/\n/g, '\n           ')}\n\n`;
      } else if (entry.type === 'ad-hoc') {
        lastMatterId = null;
        output += `   🟣 AD-HOC MATTER: ${entry.adHocMatterName || 'Unnamed Matter'}\n`;
        output += `   🔢 NUMBER: ${entry.adHocMatterNumber || 'N/A'}\n`;
        output += `      ⏱️ ${entry.hours} hrs\n`;
        output += `      📝 ${(entry.polishedNarrative || entry.narrative).replace(/\n/g, '\n           ')}\n\n`;
      } else {
        lastMatterId = null;
        const code = entry.nonChargeableCode ? ` (${entry.nonChargeableCode})` : '';
        output += `   🔸 NON-CHARGEABLE: ${entry.nonChargeableName}${code}\n`;
        if (entry.otherDescription) {
          output += `      Description: ${entry.otherDescription}\n`;
        }
        output += `      ⏱️ ${entry.hours} hrs\n`;
        output += `      📝 ${entry.polishedNarrative || entry.narrative}\n\n`;
      }
    }
    output += `\n`;
  }

  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `✨ Generated from Time Recording`;

  return output;
}
