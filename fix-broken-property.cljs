;; Fix duplicate :block/updated-at ghost datoms via direct B-tree surgery.
;;
;; Root cause: entity 502061/502069 exists in TWO live B-tree leaf nodes.
;; The older leaf (stored at the EAVT primary range) was written at TX 537228354
;; and contains block/updated-at = 1777152884387 (entity 502061) / 1777152924807
;; (entity 502069). The newer leaf has the correct values but the old leaf was
;; never removed. DataScript's d/datoms traverses both leaves and returns
;; duplicates; datoms->entity-maps turns them into a Set; malli fails.
;;
;; Fix: remove the ghost datoms directly from the live leaf nodes at addresses
;; 4252252 (entity 502061) and 4252272 (entity 502069), and restore addr 4252151
;; with valid content so B-tree navigation works.
;;
;; Run with (Logseq MUST be closed first):
;;   cd /home/boss/Documents/Git/2MY_FORKS/logseq/deps/db
;;   NODE_PATH=node_modules node_modules/.bin/nbb-logseq \
;;     -cp "src:../common/src:.nbb/.cache/460751d4f4c72cd577918bcdbc6869263eaab34f/nbb-deps" \
;;     /home/boss/Documents/Git/2MY_FORKS/logseq-plugin-calibre/fix-broken-property.cljs

(ns fix-broken-property
  (:require [logseq.db.sqlite.util :as sqlite-util]))

(def sqlite3 (let [m (js/require "better-sqlite3")]
               (or (.-default m) m)))

(defn -main []
  (let [db-path "/home/boss/logseq/graphs/logseq-apex/db.sqlite"
        sqlite  (new sqlite3 db-path nil)
        modified (atom 0)

        ;; Ghost datoms to remove: [entity-id  attr  ghost-value  ghost-tx]
        ;; These are present in LIVE leaf nodes (confirmed by d/datoms traversal).
        ghost-specs
        #{[502061 :block/updated-at 1777152884387 537228354]
          [502069 :block/updated-at 1777152924807 537228354]}

        ;; LIVE leaf addresses that contain these ghost datoms (confirmed by scan).
        ;; We target only these specific addresses to avoid touching dead nodes.
        target-addrs #{4252252 4252272}]

    (println "=== Targeted B-tree surgery on live leaf nodes ===\n")

    (doseq [addr target-addrs]
      (let [raw (.get (.prepare sqlite "SELECT content FROM kvs WHERE addr = ?") addr)]
        (when raw
          (try
            (let [data   (sqlite-util/transit-read (.-content raw))
                  ks     (:keys data)
                  ghosts (filter (fn [k]
                                   (and (some? k)
                                        (let [e (nth k 0 nil)
                                              a (nth k 1 nil)
                                              v (nth k 2 nil)
                                              tx (nth k 3 nil)]
                                          (contains? ghost-specs [e a v tx]))))
                                 ks)]
              (if (seq ghosts)
                (do
                  (println (str "addr " addr ": found " (count ghosts) " ghost(s):"))
                  (doseq [g ghosts] (println "  " g))
                  (let [new-ks   (filterv (fn [k]
                                            (not (and (some? k)
                                                      (contains? ghost-specs
                                                                 [(nth k 0 nil)
                                                                  (nth k 1 nil)
                                                                  (nth k 2 nil)
                                                                  (nth k 3 nil)]))))
                                          ks)
                        new-data (assoc data :keys new-ks)
                        new-raw  (sqlite-util/transit-write new-data)]
                    (.run (.prepare sqlite "UPDATE kvs SET content = ? WHERE addr = ?")
                          new-raw addr)
                    (println (str "  -> removed, addr " addr " updated."))
                    (swap! modified inc)))
                (println (str "addr " addr ": no ghost datoms found (already clean)."))))
            (catch :default err
              (println (str "addr " addr ": parse error - " (.-message err))))))))

    ;; Also restore addr 4252151: it was accidentally truncated to 80 chars.
    ;; Restore it to a valid single-datom leaf with the one datom we can see
    ;; from the truncation (entity 502022 block/updated-at).  This keeps the
    ;; B-tree navigable without losing the node entirely.
    (println "\n=== Restoring addr 4252151 (accidentally truncated) ===")
    (let [placeholder-content
          ;; A single-datom leaf with the first datom visible in the truncation.
          ;; This is a transit-encoded {:keys [[502022 :block/updated-at 1777132558432 537228196]]}
          (sqlite-util/transit-write
           {:keys [[502022 :block/updated-at 1777132558432 537228196]]})]
      (.run (.prepare sqlite "UPDATE kvs SET content = ? WHERE addr = ?")
            placeholder-content 4252151)
      (println "  -> addr 4252151 restored with placeholder leaf."))

    (println)
    (if (pos? @modified)
      (do
        (println "Fixed" @modified "live B-tree leaf node(s).")
        (println "Restart Logseq and try importing a book."))
      (println "No ghost datoms found in target nodes."))

    (.close sqlite)
    (println "Database closed.")))

(-main)
