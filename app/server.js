const http = require("http");

const PORT = process.env.PORT || 8081;
const VERSION = process.env.VERSION || "4.2.0";
const HEALTH_STATUS = process.env.HEALTH_STATUS || "UP";

const server = http.createServer((req, res) => {

    if (req.url === "/health") {

        if (HEALTH_STATUS === "DOWN") {
            res.writeHead(503, {
                "Content-Type": "application/json"
            });

            res.end(JSON.stringify({
                status: "DOWN",
                version: VERSION
            }));

            return;
        }

        res.writeHead(200, {
            "Content-Type": "application/json"
        });

        res.end(JSON.stringify({
            status: "UP",
            version: VERSION
        }));

        return;
    }

    if (req.url === "/") {

        res.writeHead(200, {
            "Content-Type": "application/json"
        });

        res.end(JSON.stringify({
            application: "Retail Platform",
            version: VERSION,
            status: "Running"
        }));

        return;
    }

    if (req.url === "/products") {

        res.writeHead(200, {
            "Content-Type": "application/json"
        });

        res.end(JSON.stringify({
            feature: "Product Search",
            products: [
                {
                    id: 1,
                    name: "Laptop"
                },
                {
                    id: 2,
                    name: "Mobile"
                }
            ],
            version: VERSION
        }));

        return;
    }

    if (req.url === "/payment") {

        res.writeHead(200, {
            "Content-Type": "application/json"
        });

        res.end(JSON.stringify({
            payment: "SUCCESS",
            version: VERSION
        }));

        return;
    }

    res.writeHead(404, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify({
        error: "Not Found"
    }));
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(
        `Retail Platform ${VERSION} running on port ${PORT}`
    );
});