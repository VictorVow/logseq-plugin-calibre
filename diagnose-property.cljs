;; Diagnostic: compare what DataScript's restore-conn sees vs what's in raw B-tree nodes.
;;
;;   cd /home/boss/Documents/Git/2MY_FORKS/logseq/deps/db
;;   NODE_PATH=node_modules node_modules/.bin/nbb-logseq \
;;     -cp "src:../common/src:.nbb/.cache/460751d4f4c72cd577918bcdbc6869263eaab34f/nbb-deps" \
;;     /home/boss/Documents/Git/2MY_FORKS/logseq-plugin-calibre/diagnose-property.cljs

(ns diagnose-property
  (:require [logseq.db.common.sqlite-cli :as sqlite-cli]
            [logseq.db.sqlite.util :as sqlite-util]
            [datascript.core :as d]))

(def sqlite3 (let [m (js/require "better-sqlite3")]
               (or (.-default m) m)))

(defn -main []
  (let [db-path "/home/boss/logseq/graphs/logseq-apex/db.sqlite"
        entity-ids [502061 502069]
        attr :block/updated-at

        ;; === Part 1: What DataScript's restore-conn sees ===
        {:keys [conn sqlite]} (sqlite-cli/open-sqlite-datascript! db-path)
        db @conn]

    (println "=== DataScript EAVT (after restore-conn) ===")
    (doseq [eid entity-ids]
      (let [datoms (vec (d/datoms db :eavt eid attr))]
        (println "Entity" eid attr "->")
        (doseq [d datoms]
          (println "  " (vec d)))))

    (.close sqlite)

    ;; === Part 2: Raw B-tree node scan - find ALL occurrences in LIVE nodes ===
    (println "\n=== Raw B-tree scan (ALL rows with ghost datoms) ===")
    (let [raw-sqlite (new sqlite3 db-path nil)
          all-rows (.all (.prepare raw-sqlite "SELECT addr, content FROM kvs"))
          target-eids (set entity-ids)]
      (doseq [row all-rows]
        (let [addr (.-addr row)
              raw  (.-content row)]
          (when raw
            (try
              (let [data (sqlite-util/transit-read raw)]
                (when (and (map? data) (:keys data))
                  (let [ks (:keys data)
                        matches (filter (fn [k]
                                          (and (vector? k)
                                               (contains? target-eids (nth k 0 nil))
                                               (= attr (nth k 1 nil))))
                                        ks)]
                    (when (seq matches)
                      (println "\n  addr" addr "contains" (count matches) "datom(s) for" attr ":")
                      (doseq [m matches]
                        (println "    " m))))))
              (catch :default _e nil)))))
      (.close raw-sqlite))

    (println "\nDone.")))

(-main)
