const http = require("http");

const PORT = process.env.PORT || 8081;

const request = http.get(
    `http://localhost:${PORT}/health`,
    (res) => {

        let data = "";

        res.on("data", (chunk) => {
            data += chunk;
        });

        res.on("end", () => {

            console.log("HTTP Status:", res.statusCode);
            console.log("Response:", data);

            if (res.statusCode === 200) {
                console.log("Health Test PASSED");
                process.exit(0);
            } else {
                console.log("Health Test FAILED");
                process.exit(1);
            }
        });
    }
);

request.on("error", (error) => {

    console.error("Health Test Error:", error.message);
    process.exit(1);
});