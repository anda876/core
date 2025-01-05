# FFmpeg for Deno

[![deno land](https://img.shields.io/badge/deno.land-x%2Fdeno__ffmpeg-000?logo=deno)](https://deno.land/x/deno_ffmpeg)

[![deno](https://img.shields.io/badge/deno-^2.1.4-000?logo=deno)](https://docs.deno.com/runtime/)
## Usage

::: code-group

```typescript [mp4-to-m3u8.ts]
import { ffmpeg } from "https://deno.land/x/deno_ffmpeg@v3.1.0/mod.ts";
import { join } from "jsr:@std/path";

const videoRender = ffmpeg({
    input: join(Deno.cwd(), "./demo.mp4"), // Input video file
    ffmpegDir: "D:\\ffmpeg.exe", // FFmpeg binary directory, need to be set
});

const iterator = await videoRender.save("./sample.m3u8", true, {
    "crf": "0",
    "hls_key_info_file": "D:/encrypt.key", // HLS encryption key file
});

for await (const iter of iterator) {
    console.log(`progress: ${iter.percentage}%`);
}

console.log("All encodings done!");
```

```typescript [m3u8-to-mp4.ts]
/**
 * The input must be a network address. 由于加密的缘故，在本地的
 * m3u8文件需要使用网络地址。 并且需要将密钥文件中的地址替换为本地相对路径。
*/
import { ffmpeg } from "https://deno.land/x/deno_ffmpeg@v3.1.0/mod.ts";

const videoRender = ffmpeg({
    input: "http://localhost:8000/sample.m3u8", // 必须使用网络地址
    ffmpegDir: "D:\\ffmpeg.exe",
});

const iterator = await videoRender.save(
    "./demo.mp4",
    true,
);

for await (const iter of iterator) {
    console.log(`progress: ${iter.percentage}%`);
}

console.log("All encodings done!");

// ffmpeg -i "http://localhost:8000/sample.m3u8" -c copy out.mp4
```

```typescript [m3u8-parser.ts]
import { hexStringToUint32Array, parseAttributes } from "./utils.ts";

export function parserM3U8(str: string) {
    const lines = str.split("\n");
    let match: RegExpExecArray | null;

    const manifest: Record<string, any> = {
        segments: [],
    };

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        const segment: {
            duration: number;
            uri: string;
        } = {
            duration: 0,
            uri: "",
        };

        if (line[0] !== "#") { // 往上一个的 segment 节点中添加 关联 uri
            manifest.segments[manifest.segments.length - 1].uri = line;
            continue;
        }

        if (line.indexOf("#EXT") !== 0) {
            console.log(line.slice(1));
        }

        // 去掉回车符对正则判断的影响
        line = line.replace("\r", "");

        match = (/^#EXTM3U/).exec(line);
        if (match) {
            manifest.type = "m3u";
            continue;
        }

        match = (/^#EXTINF:([0-9\.]*)?,?(.*)?$/).exec(line);
        if (match) {
            segment.duration = parseFloat(match[1]); // 小数
            manifest.segments.push(segment);
            continue;
        }

        match = (/^#EXT-X-TARGETDURATION:([0-9.]*)?/).exec(line);
        if (match) {
            manifest.targetDuration = parseInt(match[1], 10); // 整数
            continue;
        }

        match = (/^#EXT-X-VERSION:([0-9.]*)?/).exec(line);
        if (match) {
            manifest.version = parseInt(match[1], 10);
            continue;
        }

        match = (/^#EXT-X-MEDIA-SEQUENCE:(\-?[0-9.]*)?/).exec(line); // 媒体序列
        if (match) {
            manifest.sequence = parseInt(match[1], 10);
            continue;
        }

        match = (/^#EXT-X-DISCONTINUITY-SEQUENCE:(\-?[0-9.]*)?/).exec(line); // 不连续序列
        if (match) {
            manifest.sequence = parseInt(match[1], 10);
            continue;
        }

        match = (/^#EXT-X-PLAYLIST-TYPE:(.*)?$/).exec(line);
        if (match) {
            manifest.playlistType = match[1];
            continue;
        }

        match = (/^#EXT-X-ALLOW-CACHE:(YES|NO)?/).exec(line);
        if (match) {
            manifest.allowed = !(/NO/).test(match[1]);
            continue;
        }

        match = (/^#EXT-X-ENDLIST/).exec(line);
        if (match) {
            break;
        }

        match = (/^#EXT-X-KEY:(.*)$/).exec(line);
        if (match) {
            const obj = parseAttributes(match[1]) as {
                IV: string;
                URI: string;
                METHOD: "AES-128";
            };

            manifest.iv = hexStringToUint32Array(obj.IV);
            manifest.ivUri = obj.URI;
            manifest.method = obj.METHOD === "AES-128" ? "AES-CBC" : "AES-CBC";
            continue;
        }
    }

    console.log(manifest);
}

/**
#EXTM3U，是文件开始
#EXT-X-VERSION，标识HLS的协议版本号；
#EXT-X-TARGETDURATION，表示每个视频分段最大的时长（单位秒）；
#EXT-X-MEDIA-SEQUENCE，表示播放列表第一个 URL 片段文件的序列号；
#EXT-X-PLAYLIST-TYPE，表明流媒体类型；
#EXT-X-KEY，加密方式，这里加密方式为AES-128，同时指定IV，在解密时需要；
#EXTINF，表示其后 URL 指定的媒体片段时长（单位为秒）。
 */

export const attributeSeparator = function () {
    const key = "[^=]*";
    const value = '"[^"]*"|[^,]*';
    const keyvalue = "(?:" + key + ")=(?:" + value + ")";

    return new RegExp("(?:^|,)(" + keyvalue + ")");
};

export const parseAttributes = function (attributes: string) {
    const result: Record<string, string> = {};

    // 使用属性作为分隔符拆分字符串
    const attrs = attributes.split(attributeSeparator());
    let i = attrs.length;
    let attr;

    while (i--) {
        // 过滤掉字符串中不匹配的部分。
        if (attrs[i] === "") {
            continue;
        }

        // 将键和值分开。
        attr = (/([^=]*)=(.*)/).exec(attrs[i])?.slice(1) || [];
        // 去除空白并移除值周围的可选引号。
        attr[0] = attr[0].replace(/^\s+|\s+$/g, "");
        attr[1] = attr[1].replace(/^\s+|\s+$/g, "");
        attr[1] = attr[1].replace(/^['"](.*)['"]$/g, "$1");
        result[attr[0]] = attr[1];
    }
    return result;
};

export function hexStringToUint32Array(hexString: string): Uint32Array {
    // 去掉前缀 '0x'（如果有）
    if (hexString.startsWith("0x")) {
        hexString = hexString.slice(2);
    }

    // 确保字符串长度是偶数
    if (hexString.length % 2 !== 0) {
        throw new Error("Invalid hex string");
    }

    const byteArray = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
        byteArray[i / 2] = parseInt(hexString.substr(i, 2), 16);
    }

    // 将 Uint8Array 转换为 Uint32Array
    const uint32Array = new Uint32Array(byteArray.buffer);
    return uint32Array;
}
```

:::
