// 每個啟用語言的介面字典（已填好品牌），檔名帶內容 hash：/i18n/<代碼>.<hash>.json
import type { APIRoute, GetStaticPaths } from 'astro';
import { enabledLocales } from '../../profile';
import { dictAsset } from '../../i18n/server';

export const getStaticPaths: GetStaticPaths = () =>
  enabledLocales.map((l) => {
    const { url, json } = dictAsset(l);
    return { params: { file: url.slice('/i18n/'.length, -'.json'.length) }, props: { json } };
  });

export const GET: APIRoute = ({ props }) =>
  new Response((props as { json: string }).json, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
