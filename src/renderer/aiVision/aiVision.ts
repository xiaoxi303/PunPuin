import {
    addStyle,
    button,
    ele,
    frame,
    image,
    input,
    label,
    pack,
    select,
    textarea,
    view,
} from "dkh-ui";
import { Remarkable } from "remarkable";
import store from "../../../lib/store/renderStore";
import { t } from "../../../lib/translate/translate";
import type { IconType } from "../../iconTypes";
import { type aiData, runAI } from "../lib/ai";
import { writeText } from "../lib/clipboard";
import { Class, cssColor, cssVar, getImgUrl, initStyle } from "../root/root";

initStyle(store);

document.title = t("AI 视觉");

const md = new Remarkable({ breaks: true });

const content: Map<string, aiData> = new Map();

function iconEl(src: IconType) {
    return button().add(image(getImgUrl(`${src}.svg`), "icon").class("icon"));
}

const model = store.get("AI.在线模型");

const paddingVar = cssVar("o-padding");
const inputEl = textarea()
    .style({
        width: "100%",
        "max-height": "3lh",
        // @ts-ignore
        "field-sizing": "content",
        padding: paddingVar,
        border: "none",
        outline: "none",
        boxShadow: "none",
        background: "transparent",
    })
    .attr({
        autofocus: true,
        placeholder: t("输入问题，Enter 发送 / Shift+Enter 换行..."),
    });
const fileInputEl = input("file").attr({ accept: "image/*" });
const selectModelEl = select(
    model.map((x) => ({ value: x.name, label: x.name })),
);
const promptsEl = view("x", "wrap")
    .style({ gap: "6px" })
    .add(
        [
            {
                name: t("文字识别"),
                p: "识别图片上的文字，保持原有段落格式输出",
            },
            { name: t("翻译图片"), p: "将图片中的所有文字翻译成简体中文" },
            { name: t("总结要点"), p: "用简洁的要点总结图片中的核心信息" },
        ].map((x) =>
            button(x.name).on("click", (e) => {
                if (e.ctrlKey) {
                    inputEl.el.setRangeText(x.p);
                } else {
                    setItem(x.p, "text");
                    newChatItem(currentId);
                    runAIX();
                }
            }),
        ),
    );
// todo 自定义

const stopEl = iconEl("close")
    .attr({ title: "停止生成" })
    .bindSet((show: boolean, el) => {
        const El = pack(el);
        if (show) {
            El.style({ display: "" });
        } else {
            El.style({ display: "none" });
        }
    })
    .sv(false);

let currentId = uuid();

const emptyGuideEl = view("y")
    .class("pun-card")
    .style({
        padding: "16px 18px",
        gap: "6px",
        alignItems: "center",
        textAlign: "center",
        margin: "auto",
        maxWidth: "420px",
        display: model.length === 0 ? "flex" : "none",
    })
    .add([
        ele("strong").add(t("尚未配置 AI 在线模型")),
        view()
            .style({ fontSize: "12.5px", color: cssColor.font.light })
            .add(
                t("请在 设置 → 人工智能 → 在线模型 中添加支持视觉的模型后使用"),
            ),
    ]);

const showList = view("y")
    .style({
        "flex-grow": 1,
        "overflow-y": "auto",
        padding: "14px",
        gap: "12px",
    })
    .add(emptyGuideEl);

function uuid() {
    return crypto.randomUUID().slice(0, 8);
}

function newChatItem(id: string) {
    const c = content.get(id);
    emptyGuideEl.style({ display: "none" });

    let chatItem = showList.query(`[data-id="${id}"]`);
    if (!chatItem) {
        chatItem = view().data({ id }).class("chat-item");
        showList.add(chatItem);
    }
    const copyMsgBtn = iconEl("copy").attr({ title: "复制内容" });
    const toolBar = frame("tool", {
        _: view("x").class(Class.smallSize).class(Class.transition),
        copy: copyMsgBtn,
        reflash: iconEl("reload").attr({ title: "重新生成" }),
        edit: iconEl("super_edit").attr({ title: "编辑" }),
        delete: iconEl("close").attr({ title: "删除" }),
    });

    toolBar.els.copy.on("click", async () => {
        const cur = content.get(id)?.content.text;
        if (!cur) return;
        await writeText(cur);
        copyMsgBtn.attr({ title: t("已复制") });
    });
    toolBar.els.delete.on("click", () => {
        content.delete(id);
        chatItem.remove();
        setModelList(content.values().some((x) => x.content.img));
    });
    toolBar.els.edit.on("click", () => {
        const c = content.get(id);
        if (!c) return;
        inputEl.sv(c.content.text);
        currentId = id;
    });
    toolBar.els.reflash.on("click", () => {
        const keys = Array.from(content.keys());
        const nowIndex = keys.indexOf(id);
        // 在ai回答上重载，从上一个信息开始生成，覆盖当前信息
        if (content.get(id)?.role === "assistant") {
            const endIndex = nowIndex - 1;
            if (endIndex < 0) return;
            currentId = keys[endIndex];
            runAIX(id, true); // 由于删除，currentId可能为assistant
        }
        // 在用户信息上重载，从用户信息开始，覆盖下一条信息
        if (content.get(id)?.role === "user") {
            currentId = id;
            const nextId = keys[nowIndex + 1] || uuid();
            runAIX(nextId);
        }
    });

    const contentEl = view().class("chat-bubble");

    chatItem.clear().add([toolBar.el, contentEl]);

    if (!c) return;
    chatItem.class(c.role);
    if (c.content.img) {
        contentEl.add(
            image(c.content.img, "").style({
                "max-width": "300px",
                "max-height": "300px",
                borderRadius: "8px",
                marginBottom: c.content.text ? "8px" : "0",
            }),
        );
    }
    const div = view().el;
    div.innerHTML = md.render(c.content.text);
    contentEl.add(div);
}

function setModelList(isVision: boolean) {
    const oldData = selectModelEl.gv || model[0]?.name || "";
    const list = isVision ? model.filter((x) => x.supportVision) : model;
    const elList = list.map((x) =>
        ele("option").attr({
            value: x.name,
            innerText: x.name,
            selected: x.name === oldData,
        }),
    );
    selectModelEl.clear().add(elList);
}

async function runAIX(targetId?: string, force = false) {
    const x = model.find((x) => x.name === selectModelEl.gv) || model[0];
    if (!x) {
        emptyGuideEl.style({ display: "flex" });
        return;
    }
    const clipContent: typeof content = new Map();
    for (const [id, c] of content) {
        clipContent.set(id, c);
        if (id === currentId) break;
    }
    const message = Array.from(clipContent.values());
    if (message.length === 0 || (!force && message.at(-1)?.role !== "user")) {
        pickLastItem();
        return;
    }

    const a = runAI(message, x);

    const id = targetId ?? uuid();

    stopEl.sv(true);
    stopEl.el.onclick = () => {
        a.stop();
        stopEl.sv(false);
    };

    a.stream((text, end) => {
        content.set(id, {
            role: "assistant",
            content: { text: text },
        });
        newChatItem(id);
        pickLastItem();
        if (end) stopEl.sv(false);
    });
}

function pickLastItem() {
    const lastId = Array.from(content.keys()).at(-1);
    if (lastId && content.get(lastId)?.role === "user") {
        currentId = lastId;
    } else {
        const userId = uuid();
        currentId = userId;
        setItem("", "text");
    }
}

function setItem(data: string, type: "text" | "image_url") {
    const id = currentId;
    let oldData: aiData;
    if (content.has(id)) {
        // @ts-ignore
        oldData = content.get(id);
    } else {
        oldData = {
            role: "user",
            content: {
                text: "",
            },
        };
        content.set(id, oldData);
    }
    if (type === "image_url") {
        oldData.content.img = data;
    } else {
        oldData.content.text = data;
    }

    if (type === "image_url") setModelList(true);
}

// @ts-ignore
window.setImg = (url: string) => {
    const id = uuid();
    currentId = id;
    setItem(url, "image_url");
    newChatItem(id);
};

inputEl
    .on("input", () => {
        const text = inputEl.gv;
        const id = currentId;
        setItem(text, "text");
        newChatItem(id);
    })
    .on("keyup", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            runAIX();
            inputEl.sv("");
        }
    });

fileInputEl.on("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const id = currentId;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async (ev) => {
        if (!ev.target) return;
        const url = ev.target.result as string;
        setItem(url, "image_url");
        newChatItem(id);
    };
});

addStyle({
    body: {
        background: cssColor.bg,
    },
    ".chat-item": {
        "max-width": "84%",
        display: "flex",
        "flex-direction": "column",
        gap: "4px",
    },
    ".chat-bubble": {
        padding: "10px 14px",
        "border-radius": "14px",
        border: "1px solid var(--border-subtle)",
        "background-color": "var(--surface)",
        "box-shadow": "var(--shadow-sm)",
        "line-height": "1.6",
        "user-select": "text",
        "overflow-x": "auto",
    },
    ".user .chat-bubble": {
        "background-color": "var(--accent-soft)",
        "border-color":
            "color-mix(in srgb, var(--emphasis-color) 24%, transparent)",
    },
    ".system": {
        width: "100%",
    },
    ".user": {
        "margin-left": "auto",
        "align-items": "flex-end",
    },
    ".assistant": {
        "margin-right": "auto",
        "align-items": "flex-start",
    },
    ".chat-item:not(:hover) #tool_tool": {
        opacity: 0,
        "pointer-events": "none",
    },
    ".user :not(button)>img": {
        "margin-left": "auto",
    },
    ".chat-bubble ul": {
        "list-style-type": "circle",
        "padding-inline-start": "20px",
    },
    ".chat-bubble p": {
        "margin-block": "0.4em",
    },
    ".chat-bubble pre": {
        padding: "10px 12px",
        "border-radius": "8px",
        "background-color": "var(--surface-2)",
        "font-family": "var(--monospace)",
        "font-size": "12.5px",
        "overflow-x": "auto",
    },
});

view("y")
    .style({ height: "100vh" })
    .add([
        showList,
        view("y")
            .class("pun-card")
            .add([
                view("x", "wrap")
                    .style({
                        gap: "8px",
                        alignItems: "center",
                        padding: "8px 10px 0",
                    })
                    .class(Class.smallSize)
                    .add([
                        label([
                            fileInputEl.style({ display: "none" }),
                            t("上传图片"),
                        ]).class("b-like"),
                        selectModelEl,
                        promptsEl,
                        stopEl,
                    ]),
                inputEl,
            ])
            .style({
                margin: "0 10px 10px",
                gap: "4px",
                padding: "0 4px 4px",
            }),
    ])
    .addInto();
