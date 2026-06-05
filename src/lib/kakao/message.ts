export async function sendAvailabilityReminderMessage(
  receiverUuid: string,
  targetYear: number,
  targetMonth: number,
  appBaseUrl: string
): Promise<{ success: boolean }> {
  const adminKey = process.env.KAKAO_ADMIN_KEY
  if (!adminKey) {
    console.warn('KAKAO_ADMIN_KEY not set')
    return { success: false }
  }

  const link = `${appBaseUrl}/availability`
  const res = await fetch('https://kapi.kakao.com/v1/api/talk/friends/message/send', {
    method: 'POST',
    headers: {
      Authorization: `KakaoAK ${adminKey}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body: new URLSearchParams({
      receiver_uuids: JSON.stringify([receiverUuid]),
      template_object: JSON.stringify({
        object_type: 'text',
        text: `[당직 관리] ${targetYear}년 ${targetMonth}월 당직 제외일 입력을 해주세요.\n링크: ${link}`,
        link: { web_url: link, mobile_web_url: link },
        button_title: '제외일 입력하기',
      }),
    }),
  })

  return { success: res.ok }
}
