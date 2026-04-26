import "@logseq/libs";
import Fuse from "fuse.js";
import DigestClient from "digest-fetch";


export async function getCalibreItems(): Promise<CalibreItem[]> {
    const calibreLibrary = logseq.settings?.calibreLibrary.replace(/ /g, '_');
    let fetch_link = `${logseq.settings?.serverLink}/ajax/books/${calibreLibrary}`;

    // Remove double slashes in the URL (excluding the protocol part)
    fetch_link = fetch_link.replace(/([^:]\/)\/+/g, '$1');

    console.log(fetch_link);

    const client = new DigestClient(logseq.settings?.username, logseq.settings?.password);

    try {
        const response = await client.fetch(fetch_link, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache', // Prevent caching
                'Pragma': 'no-cache'         // Older HTTP/1.0 cache control
            }
        });

        if (!response.ok) {
            logseq.UI.showMsg(`
                Failed to fetch data from ${fetch_link}. The server returned status code ${response.status}. Please check the following:
                1. Verify that the URL is correct and accessible in the browser.
                2. Ensure that the Content Server is running.
                3. Confirm that the library ID is accurate.
            `, "error");
            return [];
        }

        const data = await response.json();
        const books: CalibreItem[] = Object.values(data);

        return books;
    } catch (error) {
        console.error(`Unable to fetch data from ${fetch_link}:`, error);
        logseq.UI.showMsg(`
            Unable to fetch data from ${fetch_link}. 
            Please ensure that the Content Server is running.
        `, "error");
        return [];
    }
}

export async function searchBook(search_input: string, books: CalibreItem[]): Promise<void> {
    // Fetch all Calibre items

    if (search_input === "") {
        // If no search input, display all items
        displayCalibreItems(books.map(book => ({ item: book, refIndex: -1 })));
    } else {
        // Configure Fuse.js options
        const options = {
            threshold: 0.2,
            keys: ["title", "authors"],
            distance: 1000,
        };
        const fuse = new Fuse<CalibreItem>(books, options);
        const search_results: Fuse.FuseResult<CalibreItem>[] = fuse.search(search_input);

        // Display the search results
        displayCalibreItems(search_results);
    }
}


function setAttributes(element, attrs) {
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
}

export function exitSearch() {
    let search_bar: HTMLInputElement = document.getElementById("search-bar") as HTMLInputElement;
    
    search_bar.value = "";
    search_bar.blur();
    clearSearchResults();
    logseq.provideStyle({
        style: `
        #app-container {
          width: 100% ;
        }
        `,
      })
    logseq.hideMainUI();
}

export function clearSearchResults() {
    let search_results_item_container: HTMLElement = document.getElementById("search-results") as HTMLElement;
    if (search_results_item_container.children.length > 0) {
        for (let i = 0; i < search_results_item_container.children.length; i++) {
            (search_results_item_container.children[i]).remove();
            clearSearchResults();
        }
    }
}

// search_results: a list of dictionaries with one key "item" and value metadata of 1 book.
function displayCalibreItems(search_results) {

    let calibre_item;
    let calibre_item_key;
    let calibre_item_title;
    let calibre_item_authors;
    let calibre_item_date;

    let search_result_container;
    let search_result_title_container;
    let search_result_title;
    let search_result_description_container;
    let search_result_description;
    let search_results_item_container: HTMLElement = document.getElementById("search-results") as HTMLElement;
    let search_bar: HTMLInputElement = document.getElementById("search-bar") as HTMLInputElement;
            
    if (search_results.length > 0) {
        // display search results
        for (let i = 0; i < search_results.length; i++) {
            
            calibre_item = search_results[i].item; // fuse.js return in the form [item: {} , etc..]

            calibre_item_key = calibre_item.application_id;
            calibre_item_title = calibre_item.title;
            calibre_item_authors = calibre_item.authors.join(" & ")
            calibre_item_date = calibre_item.pubdate.substring(0, 4)

            const hr = document.createElement("hr");

            search_result_container = document.createElement("li");
            search_result_container.id = calibre_item_key;

            search_result_title_container = document.createElement("div");
            search_result_title_container.id = calibre_item_key;
            search_result_title = document.createTextNode(`${calibre_item_title} `);

            search_result_description_container = document.createElement("div");
            search_result_description_container.id = calibre_item_key;
            search_result_description = document.createTextNode(`${calibre_item_authors} (${calibre_item_date})`);

            setAttributes(search_result_container, {
                "class": "search-result",
                "style": "cursor: pointer;"
            });
            setAttributes(search_result_title_container, {
                "class": "title"
            });
            setAttributes(search_result_description_container, {
                "class": "info"
            });
            search_result_container.addEventListener("click", function (e) {
                let selected_item;
                // Iterate through the list and find the inner dictionary with application_id = e.srcElement.id
                for (const search_result of search_results) {
                    if (search_result.item && search_result.item.application_id == e.srcElement.id) {
                        selected_item = search_result.item;
                        break; // Exit the loop once the desired dictionary is found
                    }
                }
                exitSearch();
                createCalibrePage(selected_item);
            });
            search_result_title_container.appendChild(search_result_title);
            search_result_description_container.appendChild(search_result_description);

            search_result_container.append(search_result_title_container, search_result_description_container);

            // Append <hr> except for the last item
            (i != (search_results.length - 1)) ? search_results_item_container.append(search_result_container, hr) : search_results_item_container.append(search_result_container);
        }
    }
    
    else if ((search_results.length == 0) && (search_bar.value != "")) {
        // Not Found
        search_result_container = document.createElement("li");
        search_result_title_container = document.createElement("div");
        search_result_title = document.createTextNode("Not found");

        setAttributes(search_result_title_container, {
            "class": "title"
        });

        search_result_title_container.appendChild(search_result_title);
        search_result_container.append(search_result_title_container);
        search_results_item_container.append(search_result_container);
    }
}

function createCalibrePage(item) {
    
    const calibre_item = item;

    let page_title = logseq.settings?.pageTitleTemplate;
    let page_title_variables = page_title.match(/({{[\s\S]*?}})/gm);

    page_title_variables.forEach(page_title_var => {
        switch (page_title_var) {

            case "{{authors}}":
            (calibre_item.authors) ? page_title = page_title.replace("{{authors}}", calibre_item.authors.join(" & ")) : page_title = page_title;
            break;

            case "{{title}}":
            (calibre_item.title) ? page_title = page_title.replace(page_title_var, calibre_item.title) : page_title = page_title.replace(page_title_var, "NA");
            break;

            case "{{date}}":
            (calibre_item.pubdate) ? page_title = page_title.replace(page_title_var, calibre_item.pubdate.substring(0, 4)) : page_title = page_title;
            break;
        }
    });

    let property_value;
    let page_properties_keys = logseq.settings?.pageProperties.split(",");
    let page_properties = {};

    // // Add Everything 
    // for (let [key, value] of Object.entries(calibre_item)) {
    //     (value) ? page_properties[key] = `"${value}"` : page_properties[key] = "NA";
    // }
    
    page_properties_keys.forEach((property) => {
        property = property.trim()
        switch (property) {
            case "calibre-tags":
            case "tags":
            property_value = calibre_item.tags?.join(', ');
            break;

            case "isbn":
            property_value = calibre_item.identifiers?.isbn;
            break;

            case "date":
            property_value = calibre_item.pubdate?.substring(0, 4);
            break;

            case "publisher":
            property_value = calibre_item.publisher;
            break;

            case "languages":
            property_value = calibre_item.languages?.join(', ');
            break;

            case "authors":
            property_value = calibre_item.authors?.map(author => `[[${author}]]`).join(', ');
            break;

            case "format":
            property_value = Object.entries(calibre_item.format_metadata ?? {})
            .map(([ext, obj]) => `[${ext}](${obj?.path})`)
            .join(', ');
            break;

            default:
            property_value = calibre_item[property];
        }

        // Remap "tags" to "calibre-tags" to avoid conflict with Logseq's
        // built-in :block/tags attribute in DB graphs
        let property_key = property === "tags" ? "calibre-tags" : property;
        // Ensure property values are strings — Logseq DB graphs require it
        if (property_value != null && typeof property_value !== 'string') {
            property_value = Array.isArray(property_value) ? property_value.join(', ') : String(property_value);
        }
        page_properties[property_key] = property_value ? property_value : "NA";
        });

        console.log("Create Page", JSON.stringify(page_properties));
        create(page_title, page_properties, calibre_item).then(() => {
    });

}


async function isDbGraph(): Promise<boolean> {
    try {
        const graph = await logseq.App.getCurrentGraph();
        return graph?.url?.startsWith('logseq_db_') ?? false;
    } catch {
        return false;
    }
}

async function ensurePropertySchemas(properties: Record<string, string>) {
    // DB graphs require property schemas to be pre-defined with the correct
    // type before upsertBlockProperty can set values. Without this,
    // upsertBlockProperty auto-infers :db.type/ref which causes datascript
    // validation failures.
    //
    // upsertProperty/removeProperty are available at runtime in modern Logseq
    // but not in the old SDK types (v0.0.14), so we access them dynamically.
    const editor = logseq.Editor as any;
    if (typeof editor.upsertProperty !== 'function') return;

    for (const key of Object.keys(properties)) {
        try {
            await editor.upsertProperty(key, { type: 'default' });
        } catch (err) {
            console.error(`Failed to ensure property schema for "${key}":`, err);
        }
    }
}

async function setBlockProperties(blockUuid: string, properties: Record<string, string>) {
    for (const [key, value] of Object.entries(properties)) {
        try {
            await logseq.Editor.upsertBlockProperty(blockUuid, key, value);
        } catch (err) {
            console.error(`Failed to set property "${key}" = "${value}":`, err);
        }
    }
}

async function create(page_title, page_properties, calibre_item) {
    const dbGraph = await isDbGraph();

    // DB graphs need property schemas pre-defined with the correct type
    // before upsertBlockProperty can set values on them
    if (dbGraph) {
        await ensurePropertySchemas(page_properties);
    }

    if (logseq.settings?.addBlockInstead) {

        const currentBlock = await logseq.Editor.getCurrentBlock()
        const newBlock = await logseq.Editor.insertBlock(currentBlock.uuid, `${page_title}`, {
            before: true,
            focus: true,
            isPageBlock: true,
        })

        if (newBlock) {
            await setBlockProperties(newBlock.uuid, page_properties);
        }

        const synopsisBlock = await logseq.Editor.insertBlock(newBlock.uuid, "[[Synopsis]]");

        await logseq.Editor.insertBlock(synopsisBlock.uuid, calibre_item?.comments? calibre_item?.comments : "");

        const calibreLibrary = logseq.settings?.calibreLibrary.replace(/ /g, '_');
        // Append two MacroRenderers for View and Sync in calibre-annotation Plugin
        await logseq.Editor.insertBlock(newBlock.uuid, `[${calibre_item.title}](calibre://show-book/${calibreLibrary}/${calibre_item.application_id})  {{renderer calibreViewer, special, /#book_id=${calibre_item.application_id}&fmt=${logseq.settings?.bookFormat}&library_id=${calibreLibrary}&mode=read_book}} {{renderer calibreHighlight, false, 2000, _, ${calibreLibrary}, ${calibre_item.application_id}, ${logseq.settings?.bookFormat}}}`);
    }
    else {
        const newPage = await logseq.Editor.createPage(page_title, {}, {
            format: "markdown",
            redirect: false,
            journal: false,
            createFirstBlock: false
        });

        if (newPage) {
            await setBlockProperties(newPage.uuid, page_properties);
        }

        // DB graphs don't support "/" in page references (namespace separator
        // is a file-graph concept), so strip the namespace prefix
        const refTitle = dbGraph ? page_title.replace(/^[^/]+\//, '') : page_title;
        logseq.Editor.insertAtEditingCursor(`[[${refTitle}]]`);
        
        logseq.Editor.exitEditingMode();


        // Append two MacroRenderers for View and Sync in calibre-annotation Plugin
        const calibreLibrary = logseq.settings?.calibreLibrary.replace(/ /g, '_');
        await logseq.Editor.appendBlockInPage(newPage?.uuid, `[${calibre_item.title}](calibre://show-book/${calibreLibrary}/${calibre_item.application_id})  {{renderer calibreViewer, special, /#book_id=${calibre_item.application_id}&fmt=${logseq.settings?.bookFormat}&library_id=${calibreLibrary}&mode=read_book}} {{renderer calibreHighlight, false, 2000, _, ${calibreLibrary}, ${calibre_item.application_id}, ${logseq.settings?.bookFormat}}}`);

        const synopsisBlock = await logseq.Editor.appendBlockInPage(newPage?.uuid, "[[Synopsis]]");

        await logseq.Editor.insertBlock(synopsisBlock.uuid, calibre_item?.comments? calibre_item?.comments : "");
    }

}


export interface CalibreItem {
    application_id: string;
    title: string;
    authors: string[];
    pubdate: string;
    tags?: string[];
    identifiers?: {
      isbn?: string;
    };
    publisher?: string;
    languages?: string[];
    format_metadata: { [key: string]: { path: string } };
    comments?: string;
  }
  
  // Type for search results from Fuse.js
  interface SearchResult {
    item: CalibreItem;
  }