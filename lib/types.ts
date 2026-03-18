export type Job = {
  title: string
  location: string
  city: string
  type: string
  category: string
  company: string
  salary: string
  summary: string
  responsibilities: string[]
  requirements: string[]
  benefits: string[]
}

export type PublishResult = {
  title: string
  success: boolean
  id?: string
  error?: string
}
