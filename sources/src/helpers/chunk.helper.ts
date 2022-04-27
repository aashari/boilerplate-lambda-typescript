/**
 * Chunk the given array into chunks of the given size.
 * @param array The array to chunk
 * @param size The size of the chunk
 * @returns The array of chunks
 */
export function chunk(array: any[], size: number): any[][] {
    const chunked_arr: any[] = [];
    let index = 0;
    while (index < array.length) {
        chunked_arr.push(array.slice(index, size + index));
        index += size;
    }
    return chunked_arr;
}
