import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import dayjs from 'dayjs';

import { WebsiteName } from '../../config';

type LetterSection = {
        heading: string;
        body: string[];
};

const DISCLAIMER = `DISCLAIMER\n\nThis document contains general information only.\n\nIt is not legal advice and is not a substitute for advice from a qualified lawyer.\nIt does not take into account your personal circumstances and does not create a lawyer–client relationship.\n\nThe information in this document is based solely on the prosecution documents you uploaded and the information available at the time it was generated.\nThose documents may be incomplete, unclear, or inaccurate.\n\nIf you have been charged with an offence, you should consider obtaining advice from a qualified legal practitioner as soon as possible.\nIf you have a court date, it is important that you do not miss it.`;

function wrapText(text: string, maxChars = 90) {
        const words = text.split(' ');
        const lines: string[] = [];
        let line = '';
        words.forEach((word) => {
                if ((line + word).length > maxChars) {
                        lines.push(line.trim());
                        line = `${word} `;
                } else {
                        line += `${word} `;
                }
        });
        if (line.trim()) lines.push(line.trim());
        return lines;
}

export async function generateInitialLetter(
        input: {
                userName: string;
                matterId: string;
                workspaceId: string;
                charges: { title: string; description?: string; confidence?: number; source?: string }[];
                summary: string;
                keyDates: string[];
                clarifications: string[];
                gaps: string[];
                generalInfo: string[];
                documentsReviewed: string[];
        },
) {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 841.89]);
        const { height } = page.getSize();
        const margin = 40;
        let cursorY = height - margin;
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const addText = (text: string, options: { size?: number; bold?: boolean; lineHeight?: number } = {}) => {
                        const size = options.size ?? 11;
                        const lineHeight = options.lineHeight ?? 16;
                        const usedFont = options.bold ? bold : font;
                        wrapText(text).forEach((line) => {
                                cursorY -= lineHeight;
                                page.drawText(line, { x: margin, y: cursorY, size, font: usedFont, color: rgb(0.1, 0.1, 0.1) });
                        });
                        cursorY -= 4;
                };

        // Header
        addText(`${WebsiteName}\nInformation Service`, { size: 14, bold: true, lineHeight: 18 });
        cursorY -= 6;
        addText(`Private & Confidential\nTo: ${input.userName}\nDate: ${dayjs().format('D MMMM YYYY')}\nReference: ${input.matterId}`);

        cursorY -= 10;
        addText('Dear ' + input.userName.split(' ')[0] + ',', { size: 12 });
        cursorY -= 6;
        addText('Initial Information Letter', { size: 15, bold: true, lineHeight: 20 });
        cursorY -= 6;
        addText(DISCLAIMER, { size: 10 });

        const sections: LetterSection[] = [
                {
                        heading: '1. Documents reviewed',
                        body: input.documentsReviewed.length
                                ? input.documentsReviewed
                                : ['Documents are registered but details are pending upload confirmation.'],
                },
                {
                        heading: '2. Charges identified (with confidence)',
                        body: input.charges.length
                                ? input.charges.map(
                                                  (charge) =>
                                                          `${charge.title} — ${charge.description ?? 'General description'}` +
                                                          (charge.confidence ? ` (confidence: ${(charge.confidence * 100).toFixed(0)}%)` : ''),
                                          )
                                : ['Apparent charges are still being clarified.'],
                },
                {
                        heading: '3. Plain-English overview of what the documents allege',
                        body: [input.summary],
                },
                {
                        heading: '4. General information relevant to these charges (Knowledge Base)',
                        body: input.generalInfo,
                },
                {
                        heading: '5. Key dates identified (or “not identified”)',
                        body: input.keyDates.length ? input.keyDates : ['Not identified in current materials.'],
                },
                {
                        heading: '6. Common clarifications from your questions',
                        body: input.clarifications.length
                                ? input.clarifications
                                : ['Questions will appear here after you ask something in chat.'],
                },
                {
                        heading: '7. What is unclear or missing',
                        body: input.gaps.length ? input.gaps : ['We will highlight gaps once analysis finds uncertainties.'],
                },
                {
                        heading: '8. General next steps (non-prescriptive)',
                        body: [
                                'Keep copies of all documents and note any dates mentioned.',
                                'Consider obtaining advice from a qualified legal practitioner as soon as possible.',
                                'If you have a court date, it is important that you do not miss it.',
                        ],
                },
        ];

        sections.forEach((section) => {
                cursorY -= 8;
                addText(section.heading, { size: 12, bold: true, lineHeight: 18 });
                section.body.forEach((paragraph) => addText(paragraph));
        });

        cursorY -= 12;
        addText('Yours sincerely,');
        addText(`${WebsiteName} — Information Service`, { bold: true });

        const pdfBytes = await pdfDoc.save();
        return pdfBytes;
}
