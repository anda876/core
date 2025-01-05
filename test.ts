export async function subtleArguments(
    iv: Uint8Array,
    content: Uint8Array,
): Promise<[AesCbcParams, CryptoKey, Uint8Array]> {
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        iv,
        "AES-CBC",
        true,
        ["encrypt", "decrypt"],
    );
    return [
        { name: "AES-CBC", iv },
        cryptoKey,
        content,
    ];
}

export async function encrypt(iv: Uint8Array, content: Uint8Array) {
    return await crypto.subtle.encrypt(...(await subtleArguments(iv, content)));
}

export async function decrypt(iv: Uint8Array, content: Uint8Array) {
    return crypto.subtle.decrypt(...(await subtleArguments(iv, content)));
}
