// WGS84 <-> GCJ02 坐标转换（收敛到共享模块，避免前后端算法漂移）
export { wgs84ToGcj02, gcj02ToWgs84 } from "../../shared/coordinate";