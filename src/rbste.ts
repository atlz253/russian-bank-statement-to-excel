import { Command } from "commander";
import ExcelJS from "exceljs";
import PDFParser, { Output } from "pdf2json";

const program = new Command();

interface Text {
  x: number;
  y: number;
  content: string;
}

interface Page {
  width: number;
  height: number;
  texts: Text[];
}

function parsePdf2jsonOutput({ Pages }: Output): Page[] {
  return Pages.map((p) => ({
    width: p.Width,
    height: p.Height,
    texts: p.Texts.map((t) => ({
      x: t.x,
      y: t.y,
      content: t.R.map((r) => decodeURIComponent(r.T)).join(""),
    })),
  }));
}

function readPDF(path: string): Promise<Page[]> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();
    parser.on("pdfParser_dataError", (error) => reject(error.parserError));
    parser.on("pdfParser_dataReady", (data) =>
      resolve(parsePdf2jsonOutput(data))
    );
    parser.loadPDF(path);
  });
}

function filterAlphaBankFirstPageTemplateContent(page: Page): Page {
  return {
    ...page,
    texts: page.texts.filter((t) => t.y >= 24 && t.y <= 44),
  };
}

function filterAlphaBankPageTemplateContent(page: Page): Page {
  return {
    ...page,
    texts: page.texts.filter((t) => t.y >= 7 && t.y <= 44),
  };
}

function groupPageContentByY(page: Page) {
  return Object.groupBy(page.texts, ({ y }) => y) as unknown as {
    [y: number]: Text[];
  };
}

function mergeAlphaBankPageParagraphs(rows: { [y: number]: Text[] }) {
  const result: { [y: number]: Text[] } = {};
  let prevY = 0;
  Object.keys(rows)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((y, i) => {
      if (i === 0) {
        prevY = y;
        result[y] = rows[y];
      } else if (y - prevY < 1.2) {
        result[prevY][2]["content"] =
          result[prevY][2]["content"] + rows[y][0]["content"];
      } else {
        prevY = y;
        result[y] = rows[y]; // TODO: fdas
      }
    });

  return result;
}

function yObjectToTextContent(rows: { [y: number]: Text[] }) {
  const result: string[][] = [];
  Object.keys(rows)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((y) => result.push(rows[y].map((t) => t.content)));
  return result;
}

function removeRURFromEndOfString(input: string) {
  return input.replace(/ RUR$/, "");
}

function removeRURFromLastColumn(row: string[]) {
  const result = [...row];
  result[result.length - 1] = removeRURFromEndOfString(
    result[result.length - 1]
  );
  return result;
}

async function alphaBankRows(path: string) {
  return [
    ["Дата проводки", "Код операции", "Описание", "Сумма в валюте счета"],
    ...(await readPDF(path))
      .map((p, i) =>
        i === 0
          ? filterAlphaBankFirstPageTemplateContent(p)
          : filterAlphaBankPageTemplateContent(p)
      )
      .map(groupPageContentByY)
      .map(mergeAlphaBankPageParagraphs)
      .map(yObjectToTextContent)
      .flat(1)
      .map(removeRURFromLastColumn),
  ];
}

async function writeRowsToExcelFile({
  rows,
  path,
}: {
  rows: string[][];
  path: string;
}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Выписка из Альфа банка");
  rows.forEach((r) => worksheet.addRow(r));
  await workbook.xlsx.writeFile(path);
}

program
  .requiredOption("-i, --input <string>", "входной PDF файл")
  .option("-o, --output <string>", "выходной Excel файл", "./output.xlsx")
  .parse();
const options = program.opts();
alphaBankRows(options["input"]).then((rows) =>
  writeRowsToExcelFile({ rows, path: options["output"] })
);
