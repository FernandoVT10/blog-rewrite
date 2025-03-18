import { Router } from "express";

import TemplateEngine from "./TemplateEngine";

const router = Router();

router.get("/", (req, res) => {
    const $title = req.query.title || "Default Title";
    TemplateEngine.sendView(res, "home", {
        $title,
        showMessage: false,
        showSubMessage: true,
        subMessage: "SUBMESSAGE!",
        message: "showMessage is true",
        obj: {
            array: ["Hello", { msg: "World" }]
        }
    });
});

export default router;
