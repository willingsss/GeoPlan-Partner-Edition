// 充电站品牌与运营商映射
export const OPERATOR_TO_BRAND: Record<string, string> = {
  state_grid: "国家电网",
  star_charge: "星星充电",
  teld: "特来电",
  nio_swap: "蔚来换电",
};

// 简易CSV解析（支持带引号的字段）
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

