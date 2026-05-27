export const DB_NAME = "shadraw-ui"
export const DB_VERSION = 1

const LEGACY_DB_NAME = "imagener"
const MIGRATION_FLAG = "shadraw-ui:idb-migrated"

export type StoreName = "history" | "projects"

const STORE_NAMES: StoreName[] = ["history", "projects"]

let migrationPromise: Promise<void> | null = null

function ensureMigrated(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (!migrationPromise) {
    migrationPromise = migrateLegacyDB().catch(() => {
      // Migration is best-effort; never block the app on it.
    })
  }
  return migrationPromise
}

async function migrateLegacyDB(): Promise<void> {
  if (window.localStorage.getItem(MIGRATION_FLAG)) return

  let hasLegacy = true
  if (typeof indexedDB.databases === "function") {
    try {
      const dbs = await indexedDB.databases()
      hasLegacy = dbs.some((d) => d.name === LEGACY_DB_NAME)
    } catch {
      hasLegacy = true
    }
  }

  if (!hasLegacy) {
    window.localStorage.setItem(MIGRATION_FLAG, "1")
    return
  }

  let legacyWasJustCreated = false
  const legacyDb = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(LEGACY_DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event) => {
      legacyWasJustCreated = true
      const db = (event.target as IDBOpenDBRequest).result
      for (const store of STORE_NAMES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id", autoIncrement: true })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  const readAll = (store: StoreName) =>
    new Promise<unknown[]>((resolve, reject) => {
      const tx = legacyDb.transaction(store, "readonly")
      const req = tx.objectStore(store).getAll()
      req.onsuccess = () => resolve(req.result as unknown[])
      req.onerror = () => reject(req.error)
    })

  const [history, projects] = await Promise.all([
    readAll("history"),
    readAll("projects"),
  ])

  legacyDb.close()

  const hasData = history.length > 0 || projects.length > 0

  if (hasData) {
    const targetDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        for (const store of STORE_NAMES) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: "id", autoIncrement: true })
          }
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    await new Promise<void>((resolve, reject) => {
      const tx = targetDb.transaction(STORE_NAMES, "readwrite")
      for (const item of history) tx.objectStore("history").put(item)
      for (const item of projects) tx.objectStore("projects").put(item)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })

    targetDb.close()
  }

  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(LEGACY_DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })

  void legacyWasJustCreated
  window.localStorage.setItem(MIGRATION_FLAG, "1")
}

export function openDB(): Promise<IDBDatabase> {
  return ensureMigrated().then(
    () =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          if (!db.objectStoreNames.contains("history")) {
            db.createObjectStore("history", {
              keyPath: "id",
              autoIncrement: true,
            })
          }
          if (!db.objectStoreNames.contains("projects")) {
            db.createObjectStore("projects", {
              keyPath: "id",
              autoIncrement: true,
            })
          }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
  )
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly")
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

export async function add<T>(
  store: StoreName,
  value: Omit<T, "id">
): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite")
    const req = tx.objectStore(store).add(value)
    req.onsuccess = () => resolve(req.result as number)
    req.onerror = () => reject(req.error)
  })
}

export async function put<T>(store: StoreName, value: T): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite")
    const req = tx.objectStore(store).put(value)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function del(store: StoreName, id: number): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite")
    const req = tx.objectStore(store).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function clear(store: StoreName): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite")
    const req = tx.objectStore(store).clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
