import { Router } from "express";

import TemplateEngine from "./TemplateEngine";

const router = Router();

const blogPosts = [
    {
        id: 1,
        cover: "https://fvtblog.com/assets/covers/blog/4763-1733785494372.webp",
        title: "Test Card",
    },
];

router.get("/", (_, res) => {
    TemplateEngine.sendView(res, "home", { blogPosts });
});

export default router;
