import * as XLSX from "xlsx";
import * as fs from "fs/promises";
import * as path from "path";
import { PolicyRecord } from "../types";

const EXPECTED_HEADERS = [
  "APÓLICE",
  "PARCELA",
  "PROPOSTA",
  "VALOR(BRL)",
  "VIGÊNCIA",
  "CNPJ/CPF",
  "NOME",
  "STATUS",
  "OBSERVAÇÃO",
];

export class PlanilhaService {
  private uploadsDir: string;
  private outputDir: string;
  private directoriesReady: Promise<void>;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), "uploads");
    this.outputDir = path.join(process.cwd(), "output");
    this.directoriesReady = this.ensureDirectories();
  }

  private async ensureDirectories() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      console.error("Erro ao criar diretórios:", error);
      throw error;
    }
  }

  /**
   * Valida se os headers da planilha estão corretos
   */
  validateHeaders(headers: string[]): boolean {
    const normalizedHeaders = headers.map((h) => h.trim().toUpperCase());
    return EXPECTED_HEADERS.every((expected) =>
      normalizedHeaders.includes(expected)
    );
  }

  /**
   * Lê planilha XLSX ou CSV e retorna array de registros
   */
  async readSpreadsheet(filePath: string): Promise<PolicyRecord[]> {
    try {
      // Verificar se o arquivo existe
      await fs.access(filePath);
      
      // Ler o arquivo do sistema de arquivos
      const fileBuffer = await fs.readFile(filePath);
      
      // Ler a planilha do buffer
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("Planilha não contém abas");
      }
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      if (!worksheet) {
        throw new Error(`Aba "${sheetName}" não encontrada na planilha`);
      }

      // Converter para JSON
      const data = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
      }) as any[][];

      if (data.length < 2) {
        throw new Error("Planilha vazia ou sem dados");
      }

      // Primeira linha são os headers
      const headers = data[0].map((h: any) => String(h).trim());
      
      if (!this.validateHeaders(headers)) {
        throw new Error(
          `Headers inválidos. Esperado: ${EXPECTED_HEADERS.join(", ")}`
        );
      }

      // Mapear headers para índices
      const headerMap: Record<string, number> = {};
      headers.forEach((h, idx) => {
        headerMap[h.toUpperCase()] = idx;
      });

      // Processar linhas de dados
      const records: PolicyRecord[] = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        
        // Pular linhas vazias
        if (row.every((cell) => !cell || String(cell).trim() === "")) {
          continue;
        }

        const apolice = String(row[headerMap["APÓLICE"]] || "").trim();
        if (!apolice) continue; // Pular se não tiver apólice

        // Normalizar status
        const statusValue = String(row[headerMap["STATUS"]] || "").trim().toLowerCase();
        let normalizedStatus: PolicyRecord["status"] = "pendente";
        
        if (statusValue === "cancelado" || statusValue === "cancelada") {
          normalizedStatus = "cancelado";
        } else if (statusValue === "processando" || statusValue === "em processamento") {
          normalizedStatus = "processando";
        } else if (statusValue === "erro" || statusValue === "error" || statusValue === "falha") {
          normalizedStatus = "erro";
        } else if (statusValue === "pendente" || statusValue === "aguardando" || statusValue === "") {
          normalizedStatus = "pendente";
        }

        records.push({
          apolice,
          parcela: String(row[headerMap["PARCELA"]] || "").trim(),
          proposta: String(row[headerMap["PROPOSTA"]] || "").trim(),
          valor: String(row[headerMap["VALOR(BRL)"]] || "").trim(),
          vigencia: String(row[headerMap["VIGÊNCIA"]] || "").trim(),
          cnpjCpf: String(row[headerMap["CNPJ/CPF"]] || "").trim(),
          nome: String(row[headerMap["NOME"]] || "").trim(),
          status: normalizedStatus,
          observacao: String(row[headerMap["OBSERVAÇÃO"]] || "").trim(),
        });
      }

      return records;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Erro ao ler planilha: ${error.message}`);
      }
      throw new Error("Erro desconhecido ao ler planilha");
    }
  }

  /**
   * Salva planilha atualizada
   */
  async saveSpreadsheet(
    records: PolicyRecord[],
    originalFileName: string
  ): Promise<string> {
    // Criar workbook
    const workbook = XLSX.utils.book_new();

    // Preparar dados
    const data: any[][] = [
      EXPECTED_HEADERS, // Headers
    ];

    records.forEach((record) => {
      data.push([
        record.apolice,
        record.parcela,
        record.proposta,
        record.valor,
        record.vigencia,
        record.cnpjCpf,
        record.nome,
        record.status,
        record.observacao,
      ]);
    });

    // Criar worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Adicionar ao workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cancelamentos");

    // Gerar nome do arquivo de saída
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const baseName = path.parse(originalFileName).name;
    const outputFileName = `${baseName}_processado_${timestamp}.xlsx`;
    const outputPath = path.join(this.outputDir, outputFileName);

    // Salvar arquivo
    XLSX.writeFile(workbook, outputPath);

    return outputPath;
  }

  /**
   * Salva arquivo enviado
   */
  async saveUploadedFile(file: Express.Multer.File): Promise<string> {
    // Garantir que os diretórios existam
    await this.directoriesReady;
    
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const fileName = `upload_${timestamp}${ext}`;
    const filePath = path.join(this.uploadsDir, fileName);

    if (!file.buffer) {
      throw new Error("Buffer do arquivo não está disponível");
    }

    await fs.writeFile(filePath, file.buffer);
    return filePath;
  }
}

