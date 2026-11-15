import { clean, getStoredToken } from './profileUtils'
export async function uploadProfileAsset(
  file,
  kind,
) {
  if (!file) return ''

  const token =
    getStoredToken()

  const normalizedKind =
    kind === 'cover'
      ? 'cover'
      : 'avatar'

  const mimeType =
    clean(file.type) ||
    'image/jpeg'

  const safeName =
    `${normalizedKind}-${clean(
      file.name ||
        `${normalizedKind}.jpg`,
    )
      .replace(
        /[^\w.\-]+/g,
        '-',
      )
      .slice(0, 90)}`

  const response =
    await fetch(
      '/api/academy/profile/uploads',
      {
        method: 'POST',
        credentials:
          'include',

        headers: {
          ...(token
            ? {
                Authorization:
                  `Bearer ${token}`,
              }
            : {}),

          'Content-Type':
            mimeType,

          'X-File-Name':
            encodeURIComponent(
              safeName,
            ),

          'X-File-Mime':
            mimeType,

          'X-Asset-Kind':
            normalizedKind,
        },

        body: file,
      },
    )

  const contentType =
    clean(
      response.headers.get(
        'content-type',
      ),
    ).toLowerCase()

  const result =
    contentType.includes(
      'application/json',
    )
      ? await response
          .json()
          .catch(() => ({}))
      : {
          success: false,
          message:
            await response
              .text()
              .catch(
                () =>
                  'Upload failed.',
              ),
        }

  if (
    !response.ok ||
    result?.success ===
      false ||
    !result?.media?.url
  ) {
    throw new Error(
      result?.message ||
        'Failed to upload profile image.',
    )
  }

  return clean(
    result.media.url,
  )
}
