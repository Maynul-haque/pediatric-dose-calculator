import Dexie from 'dexie';
import formularyData from './data/formulary.json';

export class FormularyDB extends Dexie {
  drugs!: Dexie.Table<any, string>;

  constructor() {
    super('FormularyDatabase');
    this.version(1).stores({
      drugs: 'id, generic_name, *brand_names'
    });
  }
}

export const db = new FormularyDB();

export async function loadInitialData() {
  const count = await db.drugs.count();
  if (count === 0) {
    await db.drugs.bulkPut(formularyData);
    console.log("Initial formulary data loaded into IndexedDB");
  }
}
