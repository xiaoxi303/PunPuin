import { matchFitLan } from "xtranslator";
import { Class, cssColor, getImgUrl, initStyle } from "../root/root";

const fs = require("node:fs") as typeof import("fs");

import { initFastText } from "@xushengfeng/fasttext_wasm";
import {
    button,
    ele,
    frame,
    image,
    p,
    pack,
    pText,
    spacer,
    txt,
    view,
} from "dkh-ui";

import store from "../../../lib/store/renderStore";
import { t } from "../../../lib/translate/translate";
import type { IconType } from "../../iconTypes";
import { writeText } from "../lib/clipboard";
import { getEngineLans, getTranslators } from "../lib/translate";

initStyle(store);

document.title = t("翻译");

function iconButton(img: IconType) {
    return button(image(getImgUrl(`${img}.svg`), "icon").class("icon"));
}

pack(document.body)
    .style({
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        padding: "10px",
        gap: "10px",
    })
    .class(Class.gap);

const charCount = txt("0 字").style({
    fontSize: "11.5px",
    color: cssColor.font.llight,
    fontFamily: "var(--monospace)",
});

const clearInputBtn = button("×")
    .attr({ title: "清空" })
    .style({
        width: "22px",
        height: "22px",
        padding: "0",
        borderRadius: "999px",
        fontSize: "14px",
        lineHeight: "1",
    })
    .on("click", () => {
        input.el.value = "";
        updateCharCount();
        results.clear();
        input.el.focus();
    });

const input = ele("textarea")
    .attr({ placeholder: t("输入或粘贴需要翻译的文本...") })
    .style({
        width: "100%",
        padding: "10px 12px 4px",
        border: "none",
        // @ts-ignore
        "field-sizing": "content",
        "min-height": "3.5lh",
        maxHeight: "36vh",
        outline: "none",
        boxShadow: "none",
        transition: "none",
        background: "transparent",
    });

function updateCharCount() {
    const len = input.el.value.trim().length;
    charCount.sv(`${len} ${t("字")}`);
    clearInputBtn.style({ display: len > 0 ? "inline-flex" : "none" });
}

const inputCard = view("y")
    .class("pun-card")
    .style({ flexShrink: 0, overflow: "hidden" })
    .add([
        input,
        view("x")
            .style({
                alignItems: "center",
                justifyContent: "space-between",
                padding: "4px 10px 8px",
            })
            .add([charCount, clearInputBtn]),
    ]);

const lans = view("x")
    .style({
        justifyContent: "center",
        alignItems: "center",
        flexShrink: 0,
    })
    .class(Class.gap);

const setLan = (el: HTMLSelectElement, lan: string) => {
    const supportLans = Array.from(el.querySelectorAll("option")).map(
        (i) => i.value,
    );
    const matchLan = matchFitLan(lan, supportLans) ?? supportLans[0];
    el.value = matchLan;
};

const lansFrom = ele("select")
    .on("change", () => {
        translate(input.el.value);
    })
    .bindGet((el) => el.value)
    .bindSet((lan: string, el) => setLan(el, lan));
const lansTo = ele("select")
    .on("change", () => {
        translate(input.el.value);
    })
    .bindGet((el) => el.value)
    .bindSet((lan: string, el) => setLan(el, lan));

const swapLangBtn = iconButton("replace")
    .attr({ title: "互换语言" })
    .on("click", () => {
        const fromV = lansFrom.gv;
        const toV = lansTo.gv;
        if (!toV || fromV === "auto") return;
        lansFrom.sv(toV);
        lansTo.sv(fromV);
        translate(input.el.value);
    });

const results = view("y").style({
    gap: "12px",
    padding: "2px 2px 10px",
    overflow: "auto",
});

lans.add([lansFrom, swapLangBtn, lansTo]);

inputCard.addInto();
lans.addInto();
results.addInto();

type saveData = {
    from: string;
    to: string;
    fromT: string;
    toT: string;
    engine: string;
};

function translate(_text: string) {
    results.clear();
    const text = _text.trim();
    if (!text) return;

    const fromLan = lansFrom.gv;
    const toLan = lansTo.gv;

    for (const i of fyq) {
        const copy = iconButton("copy");
        const save = iconButton("star").style({
            display:
                showCang.fetch.length || showCang.文件.length ? "" : "none",
        });
        const reTry = iconButton("reload").on("click", () => {
            f();
        });
        const checkEl = iconButton("replace").style({
            display: fromLan === "auto" ? "none" : "", // todo 读取自动语言
        });
        const e = frame(`result${i.id}`, {
            _: view().class("pun-card").style({
                width: "100%",
                padding: "12px 14px",
            }),
            title: {
                _: view("x")
                    .style({
                        "align-items": "center",
                        marginBottom: "8px",
                        paddingBottom: "8px",
                        borderBottom: "1px solid var(--border-subtle)",
                    })
                    .class(Class.smallSize)
                    .class(Class.gap),
                copy,
                save,
                reTry,
                checkEl,
                _spacer: spacer(),
                name: txt(i.name).class("pun-pill"),
            },
            content: pText(t("翻译中...")).style({
                lineHeight: "1.6",
                userSelect: "text",
            }),
            reTrans: pText("").style({
                marginBlockStart: "8px",
                color: cssColor.font.light,
                fontSize: "0.92em",
            }),
        });
        results.add(e.el);
        const c = e.els.content;
        const f = () => {
            c.sv(t("翻译中..."));
            const ff = fanyiqi.get(i.id);
            if (!ff) throw `翻译器"${i.id}"不存在`;
            ff
                // @ts-ignore
                .run(text, fromLan, toLan)
                .then((_ttext: string) => {
                    e.el.style({ order: 0 });
                    const ttext = _ttext.trim();
                    c.sv(ttext);
                    copy.on("click", () => {
                        writeText(ttext);
                        copy.attr({ title: t("已复制") });
                    });
                    save.on("click", () => {
                        saveW({
                            from: fromLan,
                            to: toLan,
                            fromT: text,
                            toT: ttext,
                            engine: i.name,
                        });
                    });
                    checkEl.on("click", async () => {
                        const t = await ff
                            // @ts-ignore
                            .run(ttext, toLan, fromLan);
                        e.els.reTrans.sv(t);
                    });
                })
                .catch((err: Error) => {
                    console.error(err);
                    e.el.style({ order: 1 });
                    if (err.message.includes("[1]")) {
                        c.sv(
                            `${t("不支持输入语言")} ${getLansName([fromLan])[0].text}`,
                        );
                    } else if (err.message.includes("[2]")) {
                        c.sv(
                            `${t("不支持输出语言")} ${getLansName([toLan])[0].text}`,
                        );
                    } else if (i.type === "bergamot") {
                        c.sv(err.message);
                    } else
                        c.sv(t("翻译失败，请重试，点击查看错误信息")).on(
                            "click",
                            () => {
                                c.sv(String(err));
                            },
                            { once: true },
                        );
                });
        };
        f();
    }
    const cl = c常用语言.filter((i) => i !== fromLan && i !== toLan);
    store.set(
        "翻译.常用语言",
        [toLan, fromLan, ...cl].filter((i) => i !== "auto").slice(0, 5),
    );

    if (fyq.length === 0) {
        results.add(p(t("请在设置添加翻译器")));
    }
}

function saveW(obj: saveData) {
    try {
        saveFile(obj);
    } catch (error) {
        console.error("保存到文件失败", error);
    }
    try {
        saveFetch(obj);
    } catch (error) {
        console.error("保存到网络失败", error);
    }
    // todo 提示
}

function saveTemplate(t: string, obj: saveData) {
    return t
        .replaceAll("${from}", obj.from)
        .replaceAll("${to}", obj.to)
        .replaceAll("${fromT}", obj.fromT)
        .replaceAll("${toT}", obj.toT)
        .replaceAll("${engine}", obj.engine);
}

function saveFile(obj: saveData) {
    const filesx = showCang.文件;
    for (const i of filesx) {
        fs.appendFile(i.path, `\n${saveTemplate(i.template, obj)}`, () => {});
    }
}

function saveFetch(obj: saveData) {
    const webx = showCang.fetch;
    for (const i of webx) {
        fetch(saveTemplate(i.url, obj), {
            method: i.method,
            body: saveTemplate(i.body, obj),
            headers: i.headers,
        });
    }
}

function getLansName(l: string[]) {
    const mainLan = store.get("语言.语言");
    const trans = new Intl.DisplayNames(mainLan, { type: "language" });
    const lansName = l.map((i) => ({
        text: i === "auto" ? t("自动") : (trans.of(i) ?? i),
        lan: i,
    }));
    return lansName.toSorted((a, b) => a.text.localeCompare(b.text, mainLan));
}

function pick2First(list: { text: string; lan: string }[], toPick: string[]) {
    const baseList = list.filter((i) => !toPick.includes(i.lan));
    const first = toPick.map(
        (i) => list.find((j) => j.lan === i) || { text: i, lan: i },
    );
    return first.concat(baseList);
}

function detectLan(text: string) {
    const fromLan = fasttext.identify(text)?.alpha2 ?? "auto";
    console.log("检测语言：", fromLan);

    const configuredTo = store.get("屏幕翻译.语言.to");
    const mConfigured = configuredTo
        ? matchFitLan(fromLan, [configuredTo])
        : undefined;
    let toLan: string;
    if (configuredTo && !mConfigured) {
        toLan = configuredTo;
    } else {
        const m = matchFitLan(fromLan, c常用语言);
        toLan =
            c常用语言.filter((i) => i !== m).at(0) ??
            store.get("语言.语言") ??
            "zh-Hans";
    }
    lansFrom.sv(fromLan);
    lansTo.sv(toLan);
}

const inputText = decodeURIComponent(
    new URLSearchParams(location.search).get("text") || "",
).trim();

const fyq = store.get("翻译.翻译器");
const fanyiqi = new Map(
    fyq.map((f) => {
        const e = getTranslators(store, f);
        return [f.id, e];
    }),
);

const showCang = store.get("翻译.收藏");

const allFromLan = Array.from(
    new Set(fyq.flatMap((f) => getEngineLans(f.type)?.lan ?? [])),
);
const allToLan = Array.from(
    new Set(fyq.flatMap((f) => getEngineLans(f.type)?.targetLan ?? [])),
);

console.log("allFromLan", allFromLan);
console.log("allToLan", allToLan);

const c常用语言 = store.get("翻译.常用语言");

lansFrom.add(
    pick2First(getLansName(allFromLan), ["auto", ...c常用语言]).map((v) =>
        ele("option").add(txt(v.text)).attr({ value: v.lan }),
    ),
);
lansTo.add(
    pick2First(getLansName(allToLan), c常用语言).map((v) =>
        ele("option").add(txt(v.text)).attr({ value: v.lan }),
    ),
);

input.el.value = inputText;
updateCharCount();

const ft = (await initFastText()).FastText();
const fasttext = await ft.loadModel();

if (inputText) {
    detectLan(inputText);
    translate(inputText);
} else {
    lansFrom.sv("auto");
    lansTo.sv(store.get("语言.语言"));
}

let composing = false;
input
    .on("compositionstart", () => {
        composing = true;
    })
    .on("compositionend", () => {
        composing = false;
    });

let lastTrans: NodeJS.Timeout;

input.on("input", () => {
    updateCharCount();
    if (composing) return;
    if (lastTrans) clearTimeout(lastTrans);
    lastTrans = setTimeout(() => {
        translate(input.el.value);
    }, 1200);
    detectLan(input.el.value);
});
