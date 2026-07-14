export interface SimplexResult {
  solution: number[];
  objectiveValue: number;
  iterations: number;
  tableaux: number[][][];
  status: 'optimal' | 'infeasible' | 'unbounded';
  variableCount: number;
}

/**
 * Tableau Simplex de Dos Fases (Minimización)
 *
 * Convención del tableau:
 *   z + Σ(T[m][j] · x_j) = T[m][n]    ⟹   z = T[m][n] - Σ(T[m][j] · x_j)
 *
 *   Para minimización:
 *     - Variable entrante: la de coeficiente MÁS POSITIVO en T[m]
 *       (aumentarla reduce z porque z = T[m][n] - T[m][j]·x_j)
 *     - Optimal cuando todos los coeficientes ≤ 0
 */
export class SimplexSolver {
  private T: number[][];
  private basic: number[];
  private m: number;
  private n: number;
  private iter: number = 0;
  private history: number[][][] = [];
  private artCols: number[] = [];
  private origVarCount: number;
  private origCosts: number[];
  private slackStart: number;
  private surplusStart: number;
  private artificialStart: number;

  constructor(
    c: number[],
    A: number[][],
    b: number[],
    signs: ('≤' | '=' | '≥')[],
  ) {
    this.origCosts = [...c];
    this.origVarCount = c.length;
    this.m = A.length;

    for (let i = 0; i < this.m; i++) {
      if (b[i] < 0) {
        for (let j = 0; j < A[i].length; j++) A[i][j] *= -1;
        b[i] *= -1;
        signs[i] = signs[i] === '≤' ? '≥' : signs[i] === '≥' ? '≤' : '=';
      }
    }

    let slackCount = 0, surplusCount = 0, artificialCount = 0;
    for (const s of signs) {
      if (s === '≤') slackCount++;
      else if (s === '=') artificialCount++;
      else { surplusCount++; artificialCount++; }
    }

    this.slackStart = c.length;
    this.surplusStart = this.slackStart + slackCount;
    this.artificialStart = this.surplusStart + surplusCount;
    this.n = this.artificialStart + artificialCount;

    this.T = Array.from({ length: this.m + 1 }, () => Array(this.n + 1).fill(0));
    this.basic = Array(this.m).fill(-1);

    for (let i = 0; i < this.m; i++) {
      for (let j = 0; j < c.length; j++) {
        this.T[i][j] = A[i][j];
      }
      this.T[i][this.n] = b[i];
    }

    let slackIdx = this.slackStart;
    let surplusIdx = this.surplusStart;
    let artIdx = this.artificialStart;
    const artRows: number[] = [];

    for (let i = 0; i < this.m; i++) {
      if (signs[i] === '≤') {
        this.T[i][slackIdx] = 1;
        this.basic[i] = slackIdx;
        slackIdx++;
      } else if (signs[i] === '=') {
        this.T[i][artIdx] = 1;
        this.artCols.push(artIdx);
        artRows.push(i);
        this.basic[i] = artIdx;
        artIdx++;
      } else {
        this.T[i][surplusIdx] = -1;
        surplusIdx++;
        this.T[i][artIdx] = 1;
        this.artCols.push(artIdx);
        artRows.push(i);
        this.basic[i] = artIdx;
        artIdx++;
      }
    }

    // Fase I: minimizar z = Σ artificials
    // z - Σ art = 0  ⟹  z + (-1)·art + (-1)·art + ... = 0
    // T[m][j] = -1 para cada artificial
    for (const ac of this.artCols) {
      this.T[this.m][ac] = -1;
    }

    // Eliminar variables artificiales básicas de la fila objetivo
    // Como T[m][bc] = -1 y T[ri][bc] = 1:
    // T[m] = T[m] - (-1) * T[ri] = T[m] + T[ri]
    for (const ri of artRows) {
      const bc = this.basic[ri];
      if (bc >= 0 && Math.abs(this.T[this.m][bc]) > 1e-12) {
        const factor = this.T[this.m][bc];
        for (let j = 0; j <= this.n; j++) {
          this.T[this.m][j] -= factor * this.T[ri][j];
        }
      }
    }

    this.saveTableau();
  }

  solve(): SimplexResult {
    // ========== FASE I ==========
    while (!this.isOptimal()) {
      const entering = this.findEntering();
      if (entering < 0) break;
      const leaving = this.findLeaving(entering);
      if (leaving < 0) {
        return {
          solution: [], objectiveValue: 0,
          iterations: this.iter, tableaux: this.history,
          status: 'unbounded', variableCount: this.origVarCount,
        };
      }
      this.pivot(leaving, entering);
      this.saveTableau();
    }

    // Si la suma de artificiales > 0, el problema es infactible
    if (Math.abs(this.T[this.m][this.n]) > 1e-6) {
      return {
        solution: [], objectiveValue: 0,
        iterations: this.iter, tableaux: this.history,
        status: 'infeasible', variableCount: this.origVarCount,
      };
    }

    // Si alguna artificial quedó básica (en 0), pivotearla para sacarla
    for (let i = 0; i < this.m; i++) {
      const bc = this.basic[i];
      if (bc >= 0 && this.artCols.includes(bc)) {
        if (Math.abs(this.T[i][this.n]) > 1e-6) {
          return {
            solution: [], objectiveValue: 0,
            iterations: this.iter, tableaux: this.history,
            status: 'infeasible', variableCount: this.origVarCount,
          };
        }
        for (let j = 0; j < this.n; j++) {
          if (!this.artCols.includes(j) && Math.abs(this.T[i][j]) > 1e-6) {
            this.pivot(i, j);
            this.saveTableau();
            break;
          }
        }
      }
    }

    // ========== FASE II ==========
    this.enterPhaseII();

    while (!this.isOptimal()) {
      const entering = this.findEntering();
      if (entering < 0) break;
      const leaving = this.findLeaving(entering);
      if (leaving < 0) {
        return {
          solution: [], objectiveValue: 0,
          iterations: this.iter, tableaux: this.history,
          status: 'unbounded', variableCount: this.origVarCount,
        };
      }
      this.pivot(leaving, entering);
      this.saveTableau();
    }

    // Extraer solución (solo vars originales)
    const solution = Array(this.origVarCount).fill(0);
    for (let i = 0; i < this.m; i++) {
      const bc = this.basic[i];
      if (bc >= 0 && bc < this.origVarCount) {
        solution[bc] = this.T[i][this.n];
      }
    }

    return {
      solution,
      objectiveValue: this.T[this.m][this.n],
      iterations: this.iter,
      tableaux: this.history,
      status: 'optimal',
      variableCount: this.origVarCount,
    };
  }

  private enterPhaseII(): void {
    const newN = this.n - this.artCols.length;
    const newT = Array.from({ length: this.m + 1 }, () => Array(newN + 1).fill(0));

    const oldToNew: number[] = Array(this.n).fill(-1);
    let newCol = 0;
    for (let j = 0; j < this.n; j++) {
      if (!this.artCols.includes(j)) {
        for (let i = 0; i <= this.m; i++) {
          newT[i][newCol] = this.T[i][j];
        }
        oldToNew[j] = newCol;
        newCol++;
      }
    }

    for (let i = 0; i <= this.m; i++) {
      newT[i][newN] = this.T[i][this.n];
    }

    const newBasic = Array(this.m).fill(-1);
    for (let i = 0; i < this.m; i++) {
      if (this.basic[i] !== -1 && !this.artCols.includes(this.basic[i])) {
        newBasic[i] = oldToNew[this.basic[i]];
      }
    }

    this.n = newN;
    this.T = newT;
    this.basic = newBasic;

    // Objetivo original: minimizar z = Σ c_j·x_j
    // z + (-c_1)x_1 + (-c_2)x_2 + ... = 0
    // T[m][j] = -c_j para vars originales
    for (let j = 0; j < this.n; j++) {
      this.T[this.m][j] = 0;
    }
    this.T[this.m][this.n] = 0;

    for (let j = 0; j < this.origVarCount; j++) {
      const mapped = oldToNew[j];
      if (mapped >= 0) {
        this.T[this.m][mapped] = -this.origCosts[j];
      }
    }

    // Eliminar variables básicas de la fila objetivo
    // T[m] = T[m] - T[m][basic] * T[constraintRow]
    for (let i = 0; i < this.m; i++) {
      const bc = this.basic[i];
      if (bc >= 0 && Math.abs(this.T[this.m][bc]) > 1e-12) {
        const factor = this.T[this.m][bc];
        for (let j = 0; j <= this.n; j++) {
          this.T[this.m][j] -= factor * this.T[i][j];
        }
      }
    }
  }

  /**
   * Optimal cuando todos los coeficientes ≤ 0.
   * z = T[m][n] - Σ T[m][j]·x_j
   * Si T[m][j] > 0, aumentar x_j DISMINUYE z → puede mejorar (min)
   * Si T[m][j] ≤ 0, aumentar x_j aumenta o no cambia z → óptimo
   */
  private isOptimal(): boolean {
    for (let j = 0; j < this.n; j++) {
      if (this.T[this.m][j] > 1e-6) return false;
    }
    return true;
  }

  /**
   * Variable entrante: la de coeficiente más POSITIVO
   * (porque z = T[m][n] - T[m][j]·x_j, coeficiente positivo → reduce z)
   */
  private findEntering(): number {
    let maxVal = 1e-6;
    let maxIdx = -1;
    for (let j = 0; j < this.n; j++) {
      if (this.T[this.m][j] > maxVal) {
        maxVal = this.T[this.m][j];
        maxIdx = j;
      }
    }
    return maxIdx;
  }

  /**
   * Prueba del cociente mínimo: min { b_i / a_i,col  |  a_i,col > 0 }
   */
  private findLeaving(col: number): number {
    let minRatio = Infinity;
    let minRow = -1;
    for (let i = 0; i < this.m; i++) {
      if (this.T[i][col] > 1e-6) {
        const ratio = this.T[i][this.n] / this.T[i][col];
        if (ratio < minRatio - 1e-6) {
          minRatio = ratio;
          minRow = i;
        }
      }
    }
    return minRow;
  }

  private pivot(row: number, col: number): void {
    const pivotVal = this.T[row][col];
    for (let j = 0; j <= this.n; j++) {
      this.T[row][j] /= pivotVal;
    }

    for (let i = 0; i <= this.m; i++) {
      if (i === row) continue;
      const factor = this.T[i][col];
      if (Math.abs(factor) < 1e-12) continue;
      for (let j = 0; j <= this.n; j++) {
        this.T[i][j] -= factor * this.T[row][j];
      }
    }

    this.basic[row] = col;
  }

  private saveTableau(): void {
    const snapshot = this.T.map(row => [...row]);
    this.history.push(snapshot);
    this.iter++;
  }
}
