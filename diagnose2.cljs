;; Full EAVT dump for corrupt entities + restore test addr.
;;
;;   cd /home/boss/Documents/Git/2MY_FORKS/logseq/deps/db
;;   NODE_PATH=node_modules node_modules/.bin/nbb-logseq \
;;     -cp "src:../common/src:.nbb/.cache/460751d4f4c72cd577918bcdbc6869263eaab34f/nbb-deps" \
;;     /home/boss/Documents/Git/2MY_FORKS/logseq-plugin-calibre/diagnose2.cljs

(ns diagnose2
  (:require [logseq.db.common.sqlite-cli :as sqlite-cli]
            [logseq.db.sqlite.util :as sqlite-util]
            [datascript.core :as d]))

(def sqlite3 (let [m (js/require "better-sqlite3")]
               (or (.-default m) m)))

(defn -main []
  (let [db-path  "/home/boss/logseq/graphs/logseq-apex/db.sqlite"
        {:keys [conn sqlite]} (sqlite-cli/open-sqlite-datascript! db-path)
        db @conn]

    (println "=== ALL EAVT datoms for entity 502061 ===")
    (doseq [d (d/datoms db :eavt 502061)]
      (println " " (vec d)))

    (println "\n=== ALL EAVT datoms for entity 502069 ===")
    (doseq [d (d/datoms db :eavt 502069)]
      (println " " (vec d)))

    (.close sqlite)

    ;; === Check/restore addr 4252151 (corrupted by test write) ===
    (println "\n=== Checking addr 4252151 ===")
    (let [raw-sqlite (new sqlite3 db-path nil)
          row (.get (.prepare raw-sqlite "SELECT length(content) as len, substr(content,1,100) as head FROM kvs WHERE addr = ?") 4252151)]
      (println "  length:" (.-len row) "head:" (.-head row))
      (.close raw-sqlite))

    (println "\nDone.")))

(-main)
